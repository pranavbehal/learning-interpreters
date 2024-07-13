import { ValueType, RuntimeVal, NumberVal, NullVal } from "./values.ts";
import {
  NodeType,
  Stmt,
  Expr,
  BinaryExpr,
  NullLiteral,
  NumericLiteral,
  Program,
} from "../frontend/ast.ts";

function eval_program(program: Program): RuntimeVal {
  let lastEvaluated: RuntimeVal = { type: "null", value: "null" } as NullVal;

  for (const statement of program.body) {
    lastEvaluated = evaluate(statement);
  }

  return lastEvaluated;
}

function eval_numeric_binary_expr(
  lhs: NumberVal,
  rhs: NumberVal,
  operator: string
): NumberVal {
  let result = 0;
  if (operator == "+") result = lhs.value + rhs.value;
  else if (operator == "-") result = lhs.value - rhs.value;
  else if (operator == "*") result = lhs.value * rhs.value;
  // TODO: Implement a division by zero check
  else if (operator == "/") result = lhs.value / rhs.value;
  else {
    result = lhs.value % rhs.value;
  }
  return { value: result, type: "number" } as NumberVal;
}

function evaluate_binary_expr(binop: BinaryExpr): RuntimeVal {
  const lhs = evaluate(binop.left);
  const rhs = evaluate(binop.right);

  if (lhs.type == "number" && rhs.type == "number") {
    return eval_numeric_binary_expr(
      lhs as NumberVal,
      rhs as NumberVal,
      binop.operator
    );
  }

  return {
    type: "null",
    value: "null",
  } as NullVal;
}

export function evaluate(astNode: Stmt): RuntimeVal {
  switch (astNode.kind) {
    case "NumericLiteral":
      return {
        value: (astNode as NumericLiteral).value,
        type: "number",
      } as NumberVal;

    case "NullLiteral":
      return { value: "null", type: "null" } as NullVal;

    case "BinaryExpr":
      return evaluate_binary_expr(astNode as BinaryExpr);

    case "Program":
      return eval_program(astNode as Program);

    default:
      console.error("This AST node has not been set up", astNode);
      Deno.exit(0);
  }
}
