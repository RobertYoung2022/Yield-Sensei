declare namespace WebAssembly {
    interface Module {}
    interface Instance {}
    function compile(bytes: BufferSource): Promise<Module>;
    function instantiate(bytes: BufferSource, importObject?: Record<string, Record<string, any>>): Promise<WebAssembly.Instance>;
}