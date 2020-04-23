var createError = require('http-errors');
const request = require("superagent");
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

const axios = require('axios')
const WebSocket = require('ws');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

const ACCESS_TOKEN = "8Ot0lh5g1YqJl8lSfWOIb7pDSCrrKdg3PocWo8WpBsk5K2L4qFpkvrvOv4Rm5L3f";

const CHAT_API_URL = "https://chat-api.zopim.com/graphql/request";
const REQUEST_ID = {
  MESSAGE_SUBSCRIPTION: 1,
  UPDATE_AGENT_STATUS: 2,
  SEND_MESSAGE: 3,
  GET_DEPARTMENTS: 4,
  TRANSFER_TO_DEPARTMENT: 5,
  SEND_QUICK_REPLIES: 6
};
const SUBSCRIPTION_DATA_SIGNAL = "DATA";
const TYPE = {
  VISITOR: "Visitor"
};

const channelsToBeTransferred = [];
let messageSubscriptionId;

async function generateNewAgentSession(access_token) {
  const query = `mutation($access_token: String!) {
        startAgentSession(access_token: $access_token) {
            websocket_url
            session_id
            client_id
        }
    }`;
  const variables = { access_token };

  console.log("[startAgentSession] Request sent");

  return await request
    .post(CHAT_API_URL)
    .set({
      "Content-Type": "application/json"
    })
    .send({ query, variables });
}

async function startAgentSession() {
  try {
    const startAgentSessionResp = (await generateNewAgentSession(ACCESS_TOKEN))
      .body;

    if (
      startAgentSessionResp.errors &&
      startAgentSessionResp.errors.length > 0
    ) {
      console.log("[startAgentSession] Invalid access token");
    } else {
      console.log(
        "[passwordStartAgentSession] Successfully start agent session"
      );

      const { websocket_url } = startAgentSessionResp.data.startAgentSession;

      connectWebSocket(websocket_url);
    }
  } catch (err) {
    console.log("[startAgentSession] Request fail");
    console.log(err.response.error.text);
  }
}

function connectWebSocket(websocket_url) {
  let webSocket = new WebSocket(websocket_url);
  let pingInterval;

  function cleanup() {
    detachEventListeners(webSocket);
    clearInterval(pingInterval);
  }

  function handleOpen() {
    console.log(`[WebSocket] Successfully connected to ${websocket_url}`);

    /*************************************************
     * Periodic ping to prevent WebSocket connection *
     * time out due to idle connection               *
     *************************************************/
    pingInterval = setInterval(() => {
      webSocket.send(
        JSON.stringify({
          sig: "PING",
          payload: +new Date()
        })
      );
    }, 5000);

    /***********************
     * Update agent status *
     ***********************/
    const updateAgentStatusQuery = {
      payload: {
        query: `mutation {
                    updateAgentStatus(status: ONLINE) {
                        node {
                            id
                        }
                    }
                }`
      },
      type: "request",
      id: REQUEST_ID.UPDATE_AGENT_STATUS
    };
    webSocket.send(JSON.stringify(updateAgentStatusQuery));
    console.log("[updateAgentStatus] Request sent");

    /************************
     * Message subscription *
     ************************/
    const messageSubscriptionQuery = {
      payload: {
        query: `subscription {
                    message {
                        node {
                            id
                            content
                            channel {
                                id
                            }
                            from {
                                __typename
                                display_name
                            }
                        }
                    }
                }`
      },
      type: "request",
      id: REQUEST_ID.MESSAGE_SUBSCRIPTION
    };
    webSocket.send(JSON.stringify(messageSubscriptionQuery));
    console.log("[message] Subscription request sent");
  }

  function handleClose() {
    console.log("[WebSocket] Connection closed abnormally. Reconnecting.");
    cleanup();
    connectWebSocket(websocket_url);
  }

  function handleMessage(message) {
    const data = JSON.parse(message);

    if (data.sig === "EOS") {
      console.log("[data] Received EOS signal. Starting a new agent session.");
      cleanup();
      startAgentSession();
    }

    // Listen to successful message subscription request
    if (data.id === REQUEST_ID.MESSAGE_SUBSCRIPTION) {
      if (data.payload.errors && data.payload.errors.length > 0) {
        console.log("[message] Failed to subscribe to message");
      } else {
        messageSubscriptionId = data.payload.data.subscription_id;
        console.log("[message] Successfully subscribe to message");
      }
    }

    // Listen to successful update agent status request
    if (data.id === REQUEST_ID.UPDATE_AGENT_STATUS) {
      if (data.payload.errors && data.payload.errors.length > 0) {
        console.log("[updateAgentStatus] Failed to update agent status");
      } else {
        console.log("[updateAgentStatus] Successfully update agent status");
      }
    }

    if (data.id === REQUEST_ID.SEND_MESSAGE) {
      if (data.payload.errors && data.payload.errors.length > 0) {
        console.log("[sendMessage] Failed to send message to visitor");
      } else {
        console.log("[sendMessage] Successfully to send message to visitor");
      }
    }

    if (data.id === REQUEST_ID.SEND_QUICK_REPLIES) {
      if (data.payload.errors && data.payload.errors.length > 0) {
        console.log("[sendQuickReplies] Failed to send message to visitor");
      } else {
        console.log(
          "[sendQuickReplies] Successfully to send message to visitor"
        );
      }
    }

    if (data.id === REQUEST_ID.TRANSFER_TO_DEPARTMENT) {
      if (data.payload.errors && data.payload.errors.length > 0) {
        console.log(
          "[transferToDepartment] Failed to transfer visitor to a department"
        );
      } else {
        console.log(
          "[transferToDepartment] Successfully to transfer visitor to a department"
        );
      }
    }

    if (data.id === REQUEST_ID.GET_DEPARTMENTS) {
      const channelToBeTransferred = channelsToBeTransferred.pop();

      if (data.payload.errors && data.payload.errors.length > 0) {
        console.log("[getDepartments] Failed to get departments info");
      } else {
        console.log("[getDepartments] Successfully to get departments info");

        const allDepartments = data.payload.data.departments.edges;
        const onlineDepartments = allDepartments.filter(
          department => department.node.status === "ONLINE"
        );

        if (onlineDepartments.length > 0) {
          const pickRandomDepartment = Math.floor(
            Math.random() * onlineDepartments.length
          );
          const onlineDepartment = onlineDepartments[pickRandomDepartment].node;

          /********************************************************
           * Notify visitor that they are going to be transferred *
           ********************************************************/
          const sendMessageQuery = {
            payload: {
              query: `mutation { 
                                sendMessage(
                                    channel_id: "${channelToBeTransferred}", 
                                    msg: "You are going to be transferred to ${
                                      onlineDepartment.name
                                    } department shortly"
                                ) {
                                    success
                                }
                            }`
            },
            type: "request",
            id: REQUEST_ID.SEND_MESSAGE
          };

          webSocket.send(JSON.stringify(sendMessageQuery));

          /***********************************
           *Transfer channel to a department *
           ***********************************/
          const transferToDepartmentQuery = {
            payload: {
              query: `mutation {
                                transferToDepartment(
                                    channel_id: "${channelToBeTransferred}", 
                                    department_id: "${onlineDepartment.id}") {
                                    success
                                }
                            }`
            },
            type: "request",
            id: REQUEST_ID.TRANSFER_TO_DEPARTMENT
          };

          webSocket.send(JSON.stringify(transferToDepartmentQuery));
        } else {
          /****************************************************
           * Notify visitor that there is no online department*
           ****************************************************/
          const sendMessageQuery = {
            payload: {
              query: `mutation {
                                sendMessage(
                                    channel_id: "${channelToBeTransferred}",
                                    msg: "Sorry, there is no online department at the moment"
                                ) {
                                    success
                                }
                            }`
            },
            type: "request",
            id: REQUEST_ID.SEND_MESSAGE
          };

          webSocket.send(JSON.stringify(sendMessageQuery));
        }
      }
    }

    // Listen to chat messages from the visitor
    if (
      data.sig === SUBSCRIPTION_DATA_SIGNAL &&
      data.subscription_id === messageSubscriptionId &&
      data.payload.data
    ) {
      const chatMessage = data.payload.data.message.node;
      const sender = chatMessage.from;

      if (sender.__typename === TYPE.VISITOR) {
        console.log(
          `[message] Received: '${chatMessage.content}' from: '${
            sender.display_name
          }'`
        );

        if (chatMessage.content.toLowerCase().includes("transfer")) {
          channelsToBeTransferred.push(chatMessage.channel.id);

          /*****************************************************************
           * Get current departments information for transferring the chat *
           *****************************************************************/
          const getDepartmentsQuery = {
            payload: {
              query: `query {
                                departments {
                                    edges {
                                        node {
                                            id
                                            name
                                            status
                                        }
                                    }
                                }
                            }`
            },
            type: "request",
            id: REQUEST_ID.GET_DEPARTMENTS
          };

          webSocket.send(JSON.stringify(getDepartmentsQuery));
        } else if (
          chatMessage.content.toLowerCase().startsWith("what ice cream flavor")
        ) {
          /*********************************
           * Send quick replies to visitor *
           *********************************/
          const sendQuickRepliesQuery = {
            payload: {
              query: `mutation {
                                sendQuickReplies(
                                    channel_id: "${chatMessage.channel.id}",
                                    msg: "We have the following options. Which one is your favorite?",
                                    quick_replies: [
                                        {
                                            action: {
                                                value: "My favorite is chocolate"
                                            },
                                            text: "Chocolate"
                                        },
                                        {
                                            action: {
                                                value: "My favorite is vanilla"
                                            },
                                            text: "Vanilla"
                                        },
                                        {
                                            action: {
                                                value: "My favorite is cookies and cream"
                                            },
                                            text: "Cookies and cream"
                                        },
                                        {
                                            action: {
                                                value: "My favorite is coconut"
                                            },
                                            text: "Coconut"
                                        },
                                        {
                                            action: {
                                                value: "My favorite is salted caramel"
                                            },
                                            text: "Salted caramel"
                                        }
                                    ],
                                    fallback: {
                                        msg: "We have the following options. Which one is your favorite?"
                                        options: [
                                            "Chocolate",
                                            "Vanilla",
                                            "Cookies and cream",
                                            "Coconut",
                                            "Salted caramel"
                                        ]
                                    }
                                ) {
                                    success
                                }
                            }`
            },
            type: "request",
            id: REQUEST_ID.SEND_QUICK_REPLIES
          };

          webSocket.send(JSON.stringify(sendQuickRepliesQuery));
        } else {
          /*************************
           * Reply back to visitor *
           *************************/
          const sendMessageQuery = {
            payload: {
              query: `mutation {
                                sendMessage(
                                    channel_id: "${chatMessage.channel.id}",
                                    msg: "${chatMessage.content}"
                                ) {
                                    success
                                }
                            }`
            },
            type: "request",
            id: REQUEST_ID.SEND_MESSAGE
          };

          webSocket.send(JSON.stringify(sendMessageQuery));
        }
      }
    }
  }

  function attachEventListeners(ws) {
    ws.addListener("open", handleOpen);
    ws.addListener("close", handleClose);
    ws.addListener("message", handleMessage);
  }

  function detachEventListeners(ws) {
    ws.removeListener("open", handleOpen);
    ws.removeListener("close", handleClose);
    ws.removeListener("message", handleMessage);
  }

  attachEventListeners(webSocket);
}

startAgentSession();

// keep the script running
process.stdin.resume();

module.exports = app;
