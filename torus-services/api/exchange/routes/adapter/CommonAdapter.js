
// Last Error Code : ERR_COMMONADAPTOR_003

// Require dependencies
var dir_path = '../../../../../';
var modPath = dir_path + 'node_modules/';
var request = require(modPath + 'request');
var commonFile = require('../util/Common');
var fs = require('fs');
var path = require('path');
var reqRedisInstance = require('../../../../../torus-references/instance/RedisInstance');

function callSaveTransactionAPI(reqObj, callback) {
    var result = []

    //   var url = reqObj.PROTOCOL + "//" + reqObj.CURL + "/Transaction/SaveTran/"
    var RedisURLKey = "NGINX_HAPROXY_URL";
    var URLPrecedence = "";

    var resObj = {};
    reqRedisInstance.GetRedisConnection(function (error, clientR) {
        if (error) {
            resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR_COMMONADAPTOR_003", "error while getting Redis Connection ", error, "", "");
            callback(resObj)
        } else {
            clientR.get(RedisURLKey, function (err, res) {
                if (err) {
                    // console.log("ERROR WHILE FETCHING HAPROXY/NGINX URL FROM REDIS " + JSON.stringify(err));
                    resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR_COMMONADAPTOR_002", "ERROR WHILE FETCHING HAPROXY/NGINX URL FROM REDIS ", err, "", "");
                    callback(resObj)
                } else if (res) {
                    URLPrecedence = JSON.parse(res)["url"];
                    console.log("URL PRECEDENCE" + URLPrecedence)

                    var url = "";
                    url = URLPrecedence.split("microsvc")[0];

                    var headers = {
                        "routingkey": reqObj["ROUTING_KEY"],
                        // "routingkey": 'CLT-1278~APP-1002~TNT-0~ENV-0', // For development
                        "session-id": reqObj["SESSION_ID"]
                    };
                    var input_request = {
                        url: url + 'Transaction/SaveTransaction/',
                        method: "POST",
                        json: true,
                        body: reqObj,
                        headers: headers
                    }

                    try {
                        console.log("INPUT REQ" + JSON.stringify(input_request))
                        request(input_request, function (error, response, body) {
                            console.log("INPUT RES" + JSON.stringify(body));
                            if (error) {
                                resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120004", "Error while calling save tran API", error, "", "");
                            } else {
                                if (body.service_status === "FAILURE" || body.service_status == undefined) {
                                    resObj = commonFile.prepareMethodResponse("FAILURE", "", "", body.error_code, "Error while calling save tran API", body, "", "");
                                }
                                else {
                                    resObj = commonFile.prepareMethodResponse("SUCCESS", "", body, "", "", "", "", "");
                                }

                            }
                            callback(resObj)
                        })
                    } catch (error) {
                        resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120005", "Exception occured while calling Change status API", error, "", "");
                        callback(resObj)
                    }

                } else {
                    resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR_COMMONADAPTOR_001", "There is no Key present within the Redis DB", '', "", "");
                    callback(resObj);
                }
            });
        }
    });
}


function checkFolderExists(path, callback) {
    // if (!path.endsWith('\\')) {
    //     path = path + "\\";
    // }

    fs.stat(path, function (err, stats) {
        if (err && err.code == 'ENOENT') {
            try {
                fs.mkdir(path, { recursive: true }, (err) => {
                    if (err) {
                        console.log(err, ' Error while creating a path')
                    }
                    callback(path);
                });
            }
            catch (ex) {
                callback(path);
            }
        } else {
            callback(path)
        }
    });
}


module.exports = {
    CallSaveTransactionAPI: callSaveTransactionAPI,
    checkFolderExists: checkFolderExists
}