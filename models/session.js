module.exports = (sequelize, type) => {
    return sequelize.define('zp-sessions', {
        id: {
          type: type.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        session_id: type.STRING,
        client_id: type.STRING,
        token: type.STRING,
        chat_api_url: type.STRING,
        websocket_url: type.STRING(1234)
    })
}