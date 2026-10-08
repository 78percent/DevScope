import * as React from "react";
import { cn } from "../../lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"section">) { return <section className={cn("rounded-xl border border-slate-200 bg-white p-6 shadow-sm", className)} {...props} />; }
export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) { return <h2 className={cn("text-lg font-semibold", className)} {...props} />; }
