var reqAppHelper = require('../../../../../../torus-references/instance/AppHelper');
var reqInstanceHelper = require('../../../../../../torus-references/common/InstanceHelper');
var DBInstance = require('../../../../../../torus-references/instance/DBInstance');
var reqLogWriter = require('../../../../../../torus-references/log/trace/LogWriter');

// Global variables
var clients = {};
var io = {};
var pHeaders = {};
var servicePath = 'SocketConsumer';
var logFilePath = 'bgprocess/consumer/socket';
var objLogInfo = reqLogWriter.GetLogInfo('SOCKET_CONSUMER', 'SOCKET_CONSUMER_PROCESS', 'SOCKET_CONSUMER_ACTION', logFilePath);
// Connect socket listemn event - will be raised from client side
function ConnectSocket() {
    try {
        const mServer = reqAppHelper.AppServer()
        io = require('socket.io')(mServer)
        // Use redis adapter
        const redis = require('socket.io-redis');
        reqInstanceHelper.ReadConfigFile(function (error, config) {
            //io.adapter(redis({ host: config.RedisServer.Server, port: config.RedisServer.Port }));
            if (error) {
                console.log(error);
            } else {
                const redis = require('redis').createClient;
                const adapter = require('@socket.io/redis-adapter');
                const pub = redis(config.RedisServer.Port, config.RedisServer.Server, { auth_pass: config.RedisServer.Password });
                const sub = redis(config.RedisServer.Port, config.RedisServer.Server, { auth_pass: config.RedisServer.Password });
                //io.adapter(adapter({ pubClient: pub, subClient: sub }));
                io.adapter(adapter(pub, sub));

                reqInstanceHelper.PrintInfo(servicePath, 'Start', objLogInfo);
                reqLogWriter.EventUpdate(objLogInfo);
                // io on connection event
                io.on('connection', function (socket) {
                    try {
                        reqInstanceHelper.PrintInfo(servicePath, 'Connected client', objLogInfo);
                        if (socket.handshake.query.SOCKET_ID) {
                            clients[socket.handshake.query.SOCKET_ID] = socket;
                            reqInstanceHelper.PrintInfo(servicePath, 'Number of connected clients : ' + Object.keys(clients).length, objLogInfo);
                            reqLogWriter.EventUpdate(objLogInfo);
                            // io on Disconnect event
                            socket.on('end', function EndSocket(SOCKET_ID, fn) {
                                try {
                                    reqInstanceHelper.PrintInfo(servicePath, 'Connection ending', objLogInfo);
                                    delete clients[SOCKET_ID];
                                    reqInstanceHelper.PrintInfo(servicePath, SOCKET_ID + ' - Socket was removed successfully', objLogInfo);
                                    reqInstanceHelper.PrintInfo(servicePath, 'End ', objLogInfo);
                                    reqLogWriter.EventUpdate(objLogInfo);
                                } catch (error) {
                                    reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'Error on socket disconnection ', error);
                                }
                            })
                        }
                        else if (socket.handshake.query.U_ID) {
                            socket.on('disconnect', () => {
                                reqInstanceHelper.PrintInfo(servicePath, 'Disconnected client ', objLogInfo);
                                DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                                    DBInstance.DeleteFXDB(pClient, 'user_sessions', {
                                        'u_id': socket.handshake.query.U_ID,
                                    }, objLogInfo, function callbackClientLogoff(pError) {
                                        // mClient.execute(DELETESESSION, [strUserid, strLoginip, strSessionid], {
                                        //     prepare: true
                                        // }, function callbackClientLogoff(pError) {
                                        try {
                                            if (pError) {
                                                // reqLogWriter.TraceError(objLogInfo, pError, "ERR-FX-10104");
                                                reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'Error on socket disconnection callbackClientLogoff function [pError]', pError);
                                            } else {
                                                reqInstanceHelper.PrintInfo(servicePath, 'Disconnected client ', objLogInfo);
                                                reqInstanceHelper.PrintInfo(servicePath, 'End ', objLogInfo);
                                                reqLogWriter.EventUpdate(objLogInfo);
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'Error on socket disconnection - callbackClientLogoff function ', error);
                                            //errorHandler("ERR-FX-10104", "Error DoClientLogoff function ERR-002 " + error)
                                        }
                                    });
                                })
                            });
                        }
                        else {
                            reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'Session ID or Qury param is missing in socket query param', 'error');
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'Error while establish the socket connection', error);
                    }
                })
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'Exception occured', error);
    }
}

// Helper function for Emit message api
function EmitMessage(appRequest, appResponse) {
    try {
        var strData = appRequest.body.DATA;
        var strSessionId = appRequest.body.SOCKET_ID;
        var strMsgKey = appRequest.body.MESSAGE_KEY
        if (clients[strSessionId]) {
            // Emit message to client (browsers)
            clients[strSessionId].emit(strMsgKey, strData);
            reqInstanceHelper.PrintInfo(servicePath, 'Socket message emitted successfully', objLogInfo);
            reqLogWriter.EventUpdate(objLogInfo);
            appResponse.send('SUCCESS');
        } else {
            reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'Connection not establised with any cients ', 'error');
            appResponse.send('Connection not establised with any cients ');
        }
    } catch (error) {
        reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'Exception occured on socket emit message', error);
        appResponse.send('Exception occured on socket emit message' + error);
    }
}

module.exports = {
    ConnectSocket: ConnectSocket,
    EmitMessage: EmitMessage
}

/********** End of file **********/