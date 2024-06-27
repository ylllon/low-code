const fs = require('fs')

module.exports = function (options = {}) {
  return  {
    name:'server',
    configureServer(server){
      server.ws.on('log', (data,client)=>{
        let files = readDir('./').files
        // writeFile();
        console.log("files:",files)

        console.log('log:',data)
      })
    }
  }
}

/**
 * 读取目录
 * @param paths
 * @returns {{path, files: *[]}}
 */
function readDir(paths){
  // console.log("!fs.lstatSync(paths):",fs.lstatSync(paths+'/'+'index.js').isDirectory())
  if(!fs.existsSync(paths) || !fs.lstatSync(paths).isDirectory){
    return{
      path: paths,
      files: []
    }
  }

  const files = fs.readdirSync(paths)
  // console.log('files:',files)

  const list = []
  files.forEach(dir => {
    list.push({
      path: paths + '/' + dir,
      name: dir,
      isDir: fs.lstatSync(paths + '/' + dir).isDirectory()
    })
  });
  return {
    path: paths,
    files: list
  }

}
/*
* @param files
* @param existWrite
* @param deleteDirs
*/
function writeFile() {
  // fs.writeFileSync('./plugin/test.js',`dadada`)
  fs.outputFileSync(filepath, content, 'utf8');
  // for (const filePath in files) {
  //   if (!existWrite && fs.existsSync(filePath)) {
  //     continue
  //   }
  //   const paths = filePath.split("/")
  //   const fileName = paths[paths.length - 1]
  //   paths.pop()
  //   const pathAll = paths.join('/')
  //   mkdirp.sync(pathAll)
  //
  // }
  return null
}