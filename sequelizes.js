const Sequelize = require('sequelize')
const sessionModel = require('./models/session')

const sequelize_db = new Sequelize('postgres://suncjvkticiuxc:aeed1fc5809e05ad48c2307b34a9db684d4175a252fccecf6900e819ec6e980f@ec2-34-198-243-120.compute-1.amazonaws.com:5432/d5m0iledijdmp0', {
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
    keepAlive: true,        
  },      
  ssl: true,
})

const zp_session = sessionModel(sequelize_db, Sequelize)

sequelize_db.sync({ force: true })
  .then(() => {
    console.log(`Database & tables created!`)
    })

module.exports = {
    zp_session
}