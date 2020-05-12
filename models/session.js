module.exports = (sequelize, type) => {
    return sequelize.define('zp-sessions', {
        id: {
          type: type.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        session_id: type.STRING(510),
        client_id: type.STRING(510),
        token: type.STRING(510),
        chat_api_url: type.STRING,
        websocket_url: type.STRING(1234)
    })
}