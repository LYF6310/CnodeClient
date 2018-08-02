const serialize = require('serialize-javascript')
const ejs = require('ejs')
const bootstrap = require('react-async-bootstrapper')
const ReactDomServer = require('react-dom/server')
const Helmet = require('react-helmet').default

const SheetsRegistry = require('react-jss').SheetsRegistry
const createGenerateClassName = require('@material-ui/core/styles').createGenerateClassName
const createMuiTheme = require('@material-ui/core/styles').createMuiTheme
const colors = require('@material-ui/core/colors')

const getStoreState = (stores) => {
  return Object.keys(stores).reduce((result, storeName) => {
    result[storeName] = stores[storeName].toJson()
    return result
  }, {})
}

// 开发和项目上线时，都能使用同一套代码实现服务端渲染

module.exports = (bundle, template, req, res) => {
  return new Promise((resolve, reject) => {
    const user = req.session.user
    const createStoreMap = bundle.createStoreMap
    const createApp = bundle.default
    const routerContext = {}
    const stores = createStoreMap()

    if (user) {
      stores.appState.user.isLogin = true
      stores.appState.user.info = user
    }

    const sheetsRegistry = new SheetsRegistry()
    const theme = createMuiTheme({
      palette: {
        primary: colors.lightBlue,
        secondary: colors.pink,
        type: 'light',
      },
    })
    const generateClassName = createGenerateClassName()
    const sheetsManager = new Map()

    const app = createApp(stores, routerContext, sheetsRegistry, generateClassName, theme, sheetsManager, req.url)
    // const app = createApp(stores, routerContext, req.url)

    bootstrap(app).then(() => {
      if (routerContext.url) { // 如果有routerContext.url属性则说明有跳转，在这里我们让路由直接在服务器端跳转，注意：renderToString后才能拿到ruoterContext.url
        res.status(302).setHeader('Location', routerContext.url)
        res.end()
        return
      }
      const helmet = Helmet.rewind()
      const state = getStoreState(stores)
      const content = ReactDomServer.renderToString(app)

      const html = ejs.render(template, {
        appString: content,
        initialState: serialize(state),
        meta: helmet.meta.toString(),
        title: helmet.title.toString(),
        style: helmet.style.toString(),
        link: helmet.link.toString(),
        materialCss: sheetsRegistry.toString(),
      })
      res.send(html)
      resolve()
    }).catch(reject)
  })
}
