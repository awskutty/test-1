/****
  Descriptions - Node app.js file to start apcp-otp consumer service  
 ****/

// Require dependencies
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqCommon = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var servicePath = 'EmailScan';
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var logFilePath = 'bgprocess/consumer/emailscan';
var objLogInfo = reqLogWriter.GetLogInfo('EMAIL_SCAN_CONSUMER', 'EMAIL_SCAN_CONSUMER_PROCESS', 'EMAIL_SCAN_CONSUMER_ACTION', logFilePath);

// Include the cluster module
var reqCluster = require('cluster');
// Code to run if we're in the master process
if (!reqCluster.isMaster) {
  // Count the machine's CPUs
  var cpuCount = require('os').cpus().length;
  // Create a worker for each CPU
  for (var i = 0; i < cpuCount; i += 1) {
    reqCluster.fork();
  }
  // Listen for dying workers
  reqCluster.on('exit', function (worker) {
    // Replace the dead worker, we're not sentimental
    reqInstanceHelper.PrintWarn(servicePath, 'Worker %d died :(' + worker.id, objLogInfo);
    reqCluster.fork();
  });
  // Code to run if we're in a worker process
} else {
  var reqEvents = require('events');
  var cron = require('node-cron');
  var reqAppHelper = require('../../../../torus-references/instance/AppHelper');
  var task = null;

  var objEvents = new reqEvents();
  objEvents.on('EventAfterInit', AfterInitDBListener);
  process.title = 'Torus_Bg_EmailScan';
  reqAppHelper.LoadAllInstanses(servicePath, function (pResult) {
    if (pResult == 'SUCCESS') {
      reqCommon.PrintInfo(servicePath, 'Instances loaded successfully.', null);
      objEvents.emit('EventAfterInit');
    }
  });

  function AfterInitDBListener() {
    try {
      //task = cron.schedule('*/60 * * * * *', function () {
      try {
        reqInstanceHelper.PrintInfo(servicePath, 'Start', objLogInfo);
        reqInstanceHelper.PrintInfo(servicePath, 'Checking For New Unread Mails...', objLogInfo);
        scanWithAllCassandraKeys();
        //task.stop(); //this stops scheduler 
      } catch (error) {
        reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'errmsg', error);
      }
      //});
      // this is for check service running
      var arrRoutes = [];
      var reqPing = require('./routes/Ping');
      arrRoutes.push(reqPing);
      reqAppHelper.StartService(servicePath, arrRoutes, __dirname);
    } catch (error) {
      reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'errmsg', error);
    }
  }

  var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
  var reqLinq = require('node-linq').LINQ;

  function scanWithAllCassandraKeys() {
    try {
      reqRedisInstance.GetRedisConnection(function (error, clientRedis) {
        try {
          if (error) {
            reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'errmsg', error);
          } else {
            clientRedis.keys('*', function (error, arrAllRedisKeys) {
              try {
                if (error) {
                  reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'errmsg', error);
                } else {
                  var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
                  var fxDBKey = 'CASSANDRA';
                  if (serviceModel.TYPE == 'LITE' || serviceModel.TYPE == 'LITE_SOLR') {
                    fxDBKey = serviceModel.TRANDB ? serviceModel.TRANDB : 'POSTGRES';
                  }
                  var arrCassandraKeys = new reqLinq(arrAllRedisKeys)
                    .Where(function (key) {
                      return key.indexOf(fxDBKey) != -1;
                    })
                    .ToArray();
                  var i = 0;
                  doWithCurrentKey(arrCassandraKeys[i]);

                  function doWithCurrentKey(currentKey) {
                    try {
                      reqInstanceHelper.PrintInfo(servicePath, 'currentKey = ' + currentKey, objLogInfo);
                      i++;
                      var headers = {
                        routingkey: currentKey.replace(fxDBKey + '~', '').toLowerCase()
                      };
                      doEmailScan(headers, function () {
                        if (i < arrCassandraKeys.length) {
                          doWithCurrentKey(arrCassandraKeys[i]);
                        } else {
                          reqInstanceHelper.PrintInfo(servicePath, 'End', objLogInfo);
                          reqLogWriter.EventUpdate(objLogInfo);
                        }
                      });
                    } catch (error) {
                      reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'errmsg', error);
                    }
                  }
                }
              } catch (error) {
                reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'errmsg', error);
              }
            });
          }
        } catch (error) {
          reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'errmsg', error);
        }
      });
    } catch (error) {
      reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'errmsg', error);
    }
  }

  // Get mail id from tenant_setup read mails
  function doEmailScan(headers, callback) {
    try {
      var emailScan = require('./routes/EmailScan');
      var receiveMailHelper = require('../../../../torus-references/communication/core/mail/IMAPMailReceiver');
      //var reqCassandraInstance = require('../../references/helper/CassandraInstance');
      var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
      //const tenentSetup = 'select * from tenant_setup';
      reqDBInstance.GetFXDBConnection(headers, 'clt_cas', objLogInfo, function (pClient) {
        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
          var cond = {};
          cond.setup_code = 'EMAIL_SCAN_DATA';
          reqsvchelper.GetSetupJson(pClient, cond, objLogInfo, function (res) {
            if (res.Status == 'SUCCESS' && res.Data.length) {
              aftergetsetupJson(res.Data);
            } else {
              return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, res.ErrorCode, res.ErrorMsg, res.Error);
            }
          });
        } else {
          var category = 'EMAIL_SCAN_DATA';
          try {
            //pClient.execute(tenentSetup, function (err, result) {
            reqDBInstance.GetTableFromFXDB(pClient, 'TENANT_SETUP', [], {}, objLogInfo, function (error, result) {
              try {
                if (error) {
                  reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'errmsg', error);
                  return callback();
                } else { }
              } catch (error) {
                reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'errmsg', error);
                return callback();
              }
            });
          } catch (error) {
            reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'errmsg', error);
            return callback();
          }

        }

        function aftergetsetupJson(result) {
          try {
            var arrScanData = new reqLinq(result)
              .Where(function (row) {
                return row.category == category;
              })
              .ToArray();
            var intArrScanDataLength = arrScanData.length;
            if (intArrScanDataLength) {
              var i = 0;
              scan(arrScanData[i]);

              function scan(row) {
                try {
                  i++;
                  var cltId = row.client_id;
                  var tntId = row.tenant_id;
                  if (row.routing_key) {
                    var routingKey = row.routing_key.toLowerCase();
                    headers.routingkey = routingKey;
                    var arrSetupJson = JSON.parse(row.setup_json);
                    var intArrSetupJsonLength = arrSetupJson.length;
                    var j = 0;
                    proccessCurrentMailId(arrSetupJson[j]);

                    function proccessCurrentMailId(setupJson) {
                      try {
                        j++;
                        var options = setupJson.OPTIONS;
                        var needEmailScan = setupJson.NEED_EMAIL_SCAN;
                        if (needEmailScan == 'Y') {
                          receiveMailHelper.ReceiveMailData(options, function (unReadMails) {
                            try {
                              var pWFTPAID = 0;
                              var SYS_ID = 0;
                              var U_ID = 1;
                              emailScan.MailReceived(headers, unReadMails, pWFTPAID, SYS_ID, U_ID, cltId, tntId, objLogInfo, function (result) {
                                try {
                                  reqInstanceHelper.PrintInfo(servicePath, 'cltId = ' + cltId + ' tntId = ' + tntId + ' routingKey = ' + routingKey + ' mailId = ' + options.user + ' result = ' + result, objLogInfo);
                                  if (j < intArrSetupJsonLength) {
                                    proccessCurrentMailId(arrSetupJson[j]);
                                  } else if (i < intArrScanDataLength) {
                                    scan(arrScanData[i]);
                                  } else {
                                    return callback();
                                  }
                                } catch (error) {
                                  reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'errmsg', error);
                                }
                              });
                            } catch (error) {
                              reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'errmsg', error);
                            }
                          });
                        } else {
                          reqInstanceHelper.PrintInfo(servicePath, 'cltId = ' + cltId + ' tntId = ' + tntId + ' routingKey = ' + routingKey + ' mailId = ' + options.user + ' result = Email Scan No Need', objLogInfo);
                          if (j < intArrSetupJsonLength) {
                            proccessCurrentMailId(arrSetupJson[j]);
                          } else if (i < intArrScanDataLength) {
                            scan(arrScanData[i]);
                          } else {
                            return callback();
                          }
                        }
                      } catch (error) {
                        reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'errmsg', error);
                      }
                    }
                  } else {
                    reqInstanceHelper.PrintWarn(servicePath, 'No routing_key found.', objLogInfo);
                    if (i < intArrScanDataLength) {
                      scan(arrScanData[i]);
                    } else {
                      return callback();
                    }
                  }
                } catch (error) {
                  reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'errmsg', error);
                }
              }
            } else {
              reqInstanceHelper.PrintWarn(servicePath, 'No EMAIL_SCAN_DATA found.', objLogInfo);
              return callback();
            }
          } catch (error) {
            reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'errmsg', error);
          }
        }
      });
    } catch (error) {
      reqInstanceHelper.PrintError(servicePath, objLogInfo, 'errcode', 'errmsg', error);
    }
  }
}

/******** End of File **********/