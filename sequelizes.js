const Sequelize = require('sequelize')
const sessionModel = require('./models/session')

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
        ssl: true
    }
})

const zp_session = sessionModel(sequelize, Sequelize)

sequelize.sync({ force: true })
  .then(() => {
    console.log(`Database & tables created!`)
    })

module.exports = {
    zp_session
}