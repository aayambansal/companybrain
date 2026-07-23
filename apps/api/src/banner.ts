/** ASCII banner printed on API startup. */
export function banner(opts: { version: string; port: number; embedding: string; llm: string }): string {
  return `
       _---~~(~~-_.          CompanyBrain API  v${opts.version}
     _{        )   )         the open-source memory layer
   ,   ) -~~- ( ,-' )_
  (  \`-,_..\`., )-- '_,)      listening   http://localhost:${opts.port}
 ( \` _)  (  -~( -_ \`,  }     docs        http://localhost:${opts.port}/docs
 (_-  _  ~_-~~~~\`,  ,' )      embeddings  ${opts.embedding}
   \`~ -^(    __;-,((()))     llm         ${opts.llm}
         ~~~~ {_ -_(())
                \`\\  }
                  { }
`;
}
