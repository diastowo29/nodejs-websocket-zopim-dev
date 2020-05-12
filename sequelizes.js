const Sequelize = require('sequelize')
const sessionModel = require('./models/session')

const sequelize_db = new Sequelize(process.env.DATABASE_URL)

const zp_session = sessionModel(sequelize_db, Sequelize)

sequelize_db.sync({ force: true })
  .then(() => {
    console.log(`Database & tables created!`)
    })

module.exports = {
    zp_session
}