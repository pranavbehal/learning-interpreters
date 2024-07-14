import {
  Stmt,
  Program,
  Expr,
  BinaryExpr,
  NumericLiteral,
  Identifier,
  VarDeclaration,
  AssignmentExpr,
  ObjectLiteral,
  Property,
  CallExpr,
  MemberExpr,
} from "./ast.ts";
import { tokenize, Token, TokenType } from "./lexer.ts";

export default class Parser {
  private tokens: Token[] = [];

  private not_eof(): boolean {
    return this.tokens[0].type != TokenType.EOF;
  }

  private at() {
    return this.tokens[0] as Token;
  }

  private eat() {
    const prev = this.tokens.shift() as Token;
    return prev;
  }

  private expect(type: TokenType, err: any) {
    const prev = this.tokens.shift() as Token;
    if (!prev || prev.type != type) {
      console.error("Parser Error:\n", err, prev, " - Expecting: ", type);
      Deno.exit(1);
    }

    return prev;
  }

  public produceAST(sourceCode: string): Program {
    this.tokens = tokenize(sourceCode);

    const program: Program = {
      kind: "Program",
      body: [],
    };

    // Parse the program until the end of the file
    while (this.not_eof()) {
      program.body.push(this.parse_stmt());
    }

    return program;
  }

  private parse_stmt(): Stmt {
    switch (this.at().type) {
      case TokenType.Let:
      case TokenType.Const:
        return this.parse_var_declaration();

      default:
        return this.parse_expr();
    }
  }

  parse_var_declaration(): Stmt {
    const isConstant = this.eat().type == TokenType.Const;
    const identifier = this.expect(
      TokenType.Identifier,
      "Expected identifier name following let or const keywords"
    ).value;

    if (this.at().type == TokenType.Semicolon) {
      this.eat();
      if (isConstant) {
        throw "You must assign a value to a constant expression";
      }

      return {
        kind: "VarDeclaration",
        identifier,
        constant: false,
      } as VarDeclaration;
    }

    this.expect(
      TokenType.Equals,
      "Expected '=' after identifier in variable declaration"
    );

    const declaration = {
      kind: "VarDeclaration",
      value: this.parse_expr(),
      identifier,
      constant: isConstant,
    } as VarDeclaration;

    // Use this line if semicolons are required, remove if not
    this.expect(TokenType.Semicolon, "Expected ';' after variable declaration");

    return declaration;
  }

  // I am implementing these in order of precendence (what needs to happen before something else)

  private parse_expr(): Expr {
    return this.parse_assignment_expr();
  }

  private parse_assignment_expr(): Expr {
    const left = this.parse_object_expr();
    if (this.at().type == TokenType.Equals) {
      this.eat();
      const value = this.parse_assignment_expr();

      return { kind: "AssignmentExpr", assigne: left, value } as AssignmentExpr;
    }

    return left;
  }

  private parse_object_expr(): Expr {
    if (this.at().type !== TokenType.OpenBrace) {
      return this.parse_additive_expr();
    }

    this.eat();
    const properties = new Array<Property>();

    while (this.not_eof() && this.at().type !== TokenType.CloseBrace) {
      const key = this.expect(
        TokenType.Identifier,
        "Object literal key expected"
      ).value;

      if (this.at().type == TokenType.Comma) {
        this.eat();
        properties.push({
          key,
          kind: "Property",
          value: undefined,
        } as Property);
        continue;
      } else if (this.at().type == TokenType.CloseBrace) {
        properties.push({
          key,
          kind: "Property",
        });
        continue;
      }

      this.expect(TokenType.Colon, "Expected ':' after object literal key");
      const value = this.parse_expr();

      properties.push({ kind: "Property", key, value });
      if (this.at().type != TokenType.CloseBrace) {
        this.expect(
          TokenType.Comma,
          "Expected ',' or '}' after object literal value"
        );
      }
    }

    this.expect(TokenType.CloseBrace, "Expected '}' after object literal");

    return { kind: "ObjectLiteral", properties } as ObjectLiteral;
  }

  private parse_additive_expr(): Expr {
    let left = this.parse_multiplicative_expr();

    while (this.at().value == "+" || this.at().value == "-") {
      const operator = this.eat().value;
      const right = this.parse_multiplicative_expr();
      left = {
        kind: "BinaryExpr",
        left,
        right,
        operator,
      } as BinaryExpr;
    }
    return left;
  }

  private parse_multiplicative_expr(): Expr {
    let left = this.parse_call_member_expr();

    while (
      this.at().value == "/" ||
      this.at().value == "*" ||
      this.at().value == "%"
    ) {
      const operator = this.eat().value;
      const right = this.parse_call_member_expr();
      left = {
        kind: "BinaryExpr",
        left,
        right,
        operator,
      } as BinaryExpr;
    }
    return left;
  }

  private parse_call_member_expr(): Expr {
    const member = this.parse_member_expr();

    if (this.at().type == TokenType.OpenParen) {
      return this.parse_call_expr(member);
    }

    return member;
  }

  // Functions (and some chaining with objects):
  private parse_call_expr(caller: Expr): Expr {
    let call_expr: Expr = {
      kind: "CallExpr",
      caller,
      args: this.parse_args(),
    } as CallExpr;

    if (this.at().type == TokenType.OpenParen) {
      call_expr = this.parse_call_expr(call_expr);
    }

    return call_expr;
  }

  private parse_args(): Expr[] {
    this.expect(TokenType.OpenParen, "Expected '(' after function call");
    const args =
      this.at().type == TokenType.CloseParen ? [] : this.parse_arguments_list();

    this.expect(TokenType.CloseParen, "Expected ')' after function call");

    return args;
  }

  private parse_arguments_list(): Expr[] {
    const args = [this.parse_assignment_expr()];

    while (this.at().type == TokenType.Comma && this.eat()) {
      args.push(this.parse_assignment_expr());
    }

    return args;
  }

  private parse_member_expr(): Expr {
    let object = this.parse_primary_expr();

    while (
      this.at().type == TokenType.Dot ||
      this.at().type == TokenType.OpenBracket
    ) {
      const operator = this.eat();
      let property: Expr;
      let computed: boolean;

      if (operator.type == TokenType.Dot) {
        computed = false;
        property = this.parse_primary_expr();

        if (property.kind != "Identifier") {
          throw `Can't use dot operator on non-identifier`;
        }
      } else {
        computed = true;
        property = this.parse_expr();

        this.expect(
          TokenType.CloseBracket,
          "Expected ']' after object property"
        );
      }

      object = { kind: "MemberExpr", object, property, computed } as MemberExpr;
    }

    return object;
  }

  private parse_primary_expr(): Expr {
    const tk = this.at().type;

    switch (tk) {
      case TokenType.Identifier:
        return { kind: "Identifier", symbol: this.eat().value } as Identifier;

      case TokenType.Number:
        return {
          kind: "NumericLiteral",
          value: parseFloat(this.eat().value),
        } as NumericLiteral;

      case TokenType.OpenParen:
        this.eat(); // eats the opening parenthesis
        const value = this.parse_expr(); // parses the expression inside the parenthesis
        this.expect(
          TokenType.CloseParen,
          "Unexpected token found inside the parenthesised expression. Expecetd closing parenthesis"
        ); // eats the closing parenthesis
        return value;

      default:
        console.error("Unexpected token found during parsing!", this.at());
        Deno.exit(1);
    }
  }
}
