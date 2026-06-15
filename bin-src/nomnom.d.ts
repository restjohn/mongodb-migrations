declare module 'nomnom' {
  interface OptionSpec {
    abbr?: string;
    full?: string;
    metavar?: string;
    flag?: boolean;
    help?: string;
    default?: unknown;
    [key: string]: unknown;
  }

  interface Command {
    option(name: string, spec: OptionSpec): Command;
    help(text: string): Command;
    callback(fn: (opts: any) => void): Command;
  }

  interface Parser {
    script(name: string): Parser;
    option(name: string, spec: OptionSpec): Parser;
    command(name: string): Command;
    nocommand(): Command;
    parse(argv?: string[]): Record<string, any>;
  }

  const parser: Parser;
  export = parser;
}
