const axios = require('axios') //
const path = require('path')
const webpack = require('webpack')
const MemoryFs = require('memory-fs')//内存中读写文件
const proxy = require('http-proxy-middleware')

const serverRender = require('./server-render')

const serverConfig = require('../../build/webpack.config.server')

const NativeModule = require('module')
const vm = require('vm')

const getModuleFromString = (bundle, filename) => {
  const m = { exports: {} }
  const wrapper = NativeModule.wrap(bundle)
  const script = new vm.Script(wrapper, {
    filename: filename,
    displayErrors: true,
  })
  const result = script.runInThisContext()
  result.call(m.exports, m.exports, require, m)
  return m
}
//获取启动的服务中，内存里的template
const getTemplate = () => {
  return new Promise((resolve,reject) =>{
    axios.get('http://localhost:8888/public/server.ejs') //获取webpack-dev-server打包出来的文件
    .then(res => {
      resolve(res.data)
    })
    .catch(reject)
  })
}

const mfs = new MemoryFs
const serverCompiler = webpack(serverConfig) //监听webpack下的文件是否有变化，有变化就重新打包
serverCompiler.outputFileSystem = mfs // 
let serverBundle// , createStoreMap//热模块替换更改后的内容d
serverCompiler.watch({},(err,stats) => {
  if(err) throw err
  stats = stats.toJson()
  stats.errors.forEach( err => console.log(err))
  stats.warnings.forEach(warn => console.log(warn))

  const bundlePath = path.join(
    serverConfig.output.path,
    serverConfig.output.filename
  )
  const bundle = mfs.readFileSync(bundlePath, 'utf-8') //内存中把文件读取出来
  const m = getModuleFromString(bundle, 'server-entry.js')
  serverBundle = m.exports
})

module.exports = function (app) {

  app.use('/public',proxy({
    target: 'http://localhost:8888'
  }))

  app.get('*',function(req, res, next){
    if(!serverBundle) {
      return res.send('waiting for compile, refresh later')
    }
    getTemplate().then(template => {
      return serverRender(serverBundle, template, req, res)
    }).catch(next)
  })
}
