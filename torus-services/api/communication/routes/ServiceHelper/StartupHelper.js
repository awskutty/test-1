var reqLinq = require('node-linq').LINQ;
var reqRedisInstance = require('../../../../../torus-references/instance/RedisInstance');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var serviceName = 'Communication';
var reqAsync = require('async');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');

var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
var serviceArr = [];
if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
    serviceArr = [];
} else {
    var reqmailsms = require('../mailsms');
    var reqmsgCreator = require('../MessageCreator');
    var reqmsgFailure = require('../MessageFailureHandler');
    serviceArr = [reqmailsms.sendMailSMS, reqmsgCreator.MessageCreator, reqmsgFailure.FailureHandler];
}

var objLogInfo = {};


function GetHeaderInfo(PcallBack) {
    reqRedisInstance.GetRedisConnection(function (error, clientRedis) {
        try {
            if (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
            } else {
                clientRedis.keys('*', function (error, arrAllRedisKeys) {
                    try {
                        if (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                        } else {
                            var connStr = 'TRANDB';
                            var arrTranDBKeys = new reqLinq(arrAllRedisKeys)
                                .Where(function (key) {
                                    var tempConStr = key.split('~')[0];
                                    if (tempConStr == connStr) {
                                        return true;
                                    } else {
                                        return false;
                                    }
                                })
                                .ToArray();
                            var i = 0;
                            if (arrTranDBKeys.length) {
                                doWithCurrentKey(arrTranDBKeys[i]);
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'No TRANDB Key Found', objLogInfo);
                                PcallBack();
                            }

                            function doWithCurrentKey(currentKey) {
                                try {
                                    i++;
                                    reqInstanceHelper.GetConfig(currentKey, function (currJson) {
                                        reqInstanceHelper.PrintInfo(serviceName, "Starting thread for currentKey - " + currentKey, '', objLogInfo);
                                        var isChildRunning = checkChildRunning(currJson);
                                        if (!isChildRunning) {
                                            var headers = {
                                                routingkey: currentKey.replace(connStr + '~', '').toLowerCase()
                                            };
                                            var jsonToSend = {
                                                AppId: '0',
                                                Header: headers,
                                                LogInfo: objLogInfo
                                            };
                                            if (currentKey) { //'TRANDB~CLT-1304~APP-109~TNT-0~ENV-DEV'
                                                reqAsync.forEachSeries(serviceArr, function (service, serviceCallback) {
                                                    service(jsonToSend, function (msgFromWorker) {
                                                        addNewChildToArray(currJson);
                                                        serviceCallback();
                                                        reqInstanceHelper.PrintInfo(serviceName, msgFromWorker, objLogInfo);
                                                    });
                                                }, function (error) {
                                                    if (error) {
                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'Error in ForEachSeries section', error);
                                                    } else {
                                                        if (i < arrTranDBKeys.length) {
                                                            doWithCurrentKey(arrTranDBKeys[i]);
                                                        }
                                                    }
                                                });
                                            } else {
                                                if (i < arrTranDBKeys.length) {
                                                    doWithCurrentKey(arrTranDBKeys[i]);
                                                } else {
                                                    PcallBack();
                                                }
                                            }
                                        } else {
                                            if (i < arrTranDBKeys.length) {
                                                doWithCurrentKey(arrTranDBKeys[i]);
                                            } else {
                                                PcallBack();
                                            }
                                        }
                                    });
                                } catch (error) {
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                                }
                            }
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                    }
                });
            }
        } catch (error) {
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
        }
    });
}

var arrRunningChilds = [];

// Check for any child process is running or not
function checkChildRunning(jsonToStart) {
    for (var i = 0; i < arrRunningChilds.length; i++) {
        var runningJson = JSON.parse(arrRunningChilds[i].toString().toUpperCase());
        var jsonStart = JSON.parse(jsonToStart.toString().toUpperCase());
        var flag = false;
        runningJson['DB_TYPE'] = (runningJson['DB_TYPE'] != undefined && runningJson['DB_TYPE'] != null && runningJson['DB_TYPE'] != '') ? runningJson['DB_TYPE'] : 'PG';
        jsonStart['DB_TYPE'] = (jsonStart['DB_TYPE'] != undefined && jsonStart['DB_TYPE'] != null && jsonStart['DB_TYPE'] != '') ? jsonStart['DB_TYPE'] : 'PG';

        if (runningJson['DB_TYPE'] == jsonStart['DB_TYPE'] && runningJson['SERVER'] == jsonStart['SERVER'] && runningJson['PORT'] == jsonStart['PORT'] && runningJson['DATABASE'] == jsonStart['DATABASE'] && runningJson['SEARCHPATH'] == jsonStart['SEARCHPATH']) {
            return true;
            break;
        } else {
            continue;
        }
    }
    return false;
}

// Add an object to array
function addNewChildToArray(currJson) {
    arrRunningChilds.push(currJson);
}

module.exports = {
    GetHeaderInfo: GetHeaderInfo
};