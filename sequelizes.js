const Sequelize = require('sequelize')
const sessionModel = require('./models/session')

const sequelize = new Sequelize('zp-db', 'root', '', {
  host: 'localhost',
  dialect: 'mysql',
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
})

const zp_session = sessionModel(sequelize, Sequelize)

sequelize.sync({ force: true })
  .then(() => {
    console.log(`Database & tables created!`)

    // zp_session.create({
    //     session_id: "",
    //     client_id: "",
    //     token: "8Ot0lh5g1YqJl8lSfWOIb7pDSCrrKdg3PocWo8WpBsk5K2L4qFpkvrvOv4Rm5L3f",
    //     chat_api_url: "https://chat-api.zopim.com/graphql/request",
    //     websocket_url: ""
    //   }).then(
    //   userTeravinData => {
    //     console.log('success create 1 session')
    //     // console.log(userTeravinData)
    //   })

    })

module.exports = {
    zp_session
}