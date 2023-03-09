import * as Comlink from "https://unpkg.com/comlink/dist/esm/comlink.mjs";

// https://stackoverflow.com/questions/57121467
function doimport(str) {
  if (globalThis.URL.createObjectURL) {
    const blob = new Blob([str], { type: 'text/javascript' })
    const url = URL.createObjectURL(blob)
    const module = import(url)
    URL.revokeObjectURL(url) // GC objectURLs
    return module
  }
  
  const url = "data:text/javascript;base64," + btoa(moduleData)
  return import(url)
}

async function init() {

  // load the emception webworker and wrap it with comlink
  const worker = new Worker("./emception/emception.worker.bundle.worker.js");
  const emception = Comlink.wrap(worker);

  window.emception = emception;
  window.Comlink = Comlink;

  const output = document.getElementById("console");
  function addToConsole(data) {
    output.appendChild(document.createTextNode(data.join(" ") + "\n"));
  }

  emception.onstdout = Comlink.proxy(console.log);
  emception.onstderr = Comlink.proxy(console.error);
  emception.onprocessstart = Comlink.proxy(addToConsole);

  const compile = document.getElementById("compile");
  const code = document.getElementById("code");
  const body = document.querySelector("body");
  

  compile.addEventListener("click", async (evt) => {
    evt.preventDefault();
    output.innerText="";
    compile.disabled = true;
    if (window.wasmScript) {
      body.removeChild(window.wasmScript);
    }
    if (window.runBtn) {
      body.removeChild(window.runBtn);
    }
    try {
      await emception.fileSystem.writeFile("/working/main.cpp", code.value);
      const cmd = `emcc -O3 -sSINGLE_FILE=1 -sNO_EXIT_RUNTIME=1 -sEXPORTED_RUNTIME_METHODS=['ccall','cwrap'] -sEXPORTED_FUNCTIONS=['_malloc','_free','_foo'] -sEXPORT_ES6=1 -sUSE_ES6_IMPORT_META=0 -sMODULARIZE=1 -sEXPORT_NAME='loadModule' -sALLOW_MEMORY_GROWTH main.cpp -o main.js`;
      const result = await emception.run(cmd);
      if (result.returncode == 0) {
        console.log("compile succeeded");
        // load the js file we compiled
        const content = await emception.fileSystem.readFile("/working/main.js", {encoding: "utf8"});
        // console.log(content);
        // load this module
        // default loads the default module
        const loadModule = (await doimport(new Blob([content]))).default;

        const compiledModule = await loadModule();
        const main = compiledModule.cwrap("foo", "null", []);

        const runBtn = document.createElement("button");
        runBtn.appendChild(document.createTextNode("run"));
        runBtn.addEventListener("click", (evt) => {
          evt.preventDefault();
          main();
        });
        body.appendChild(runBtn);
        window.runBtn = runBtn;
        console.log("imported");
        
      } else {
        console.log("Emception compilation failed.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      compile.disabled = false;
    }
    
  });

  console.log("Loading emception...");
  await emception.init();

  console.log("Emception loaded");
  compile.disabled = false;
}

init();