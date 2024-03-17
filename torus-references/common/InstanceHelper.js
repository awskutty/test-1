try {
  /*
  @Decsription: To declare common functions that will be call from all services and helper files  
  @LAST_ERROR_CODE: ERR_INSTANCE_HELPER_0031
*/

  // Require dependencies
  var colors = require('colors/safe');
  var reqMoment = require('moment');
  var path = require('path');
  var fs = require('fs');
  var shell = require('shelljs');
  var reqRedisInstance = require('../instance/RedisInstance');
  var reqEncryptionInstance = require('./crypto/EncryptionInstance');
  var reqDateFormatter = require('./dateconverter/DateFormatter');
  var errPad = 5;
  var serviceNamePad = 25;
  var infoKeyWord = 'INFO';
  var warnKeyWord = 'WARN';
  var errKeyWord = 'ERROR';
  var defaultRoutingKey = 'clt-0~app-0~tnt-0~env-0';
  var serviceName = 'InstanceHelper';
  var reqAsync = require('async');
  var objLogInfo = null;
  var tenantLevelTimezoneSession = {};
  var ServiceParamsSession = {};

  // Color for console log
  colors.setTheme({
    warn: 'yellow',
    debug: 'blue',
    error: 'red'
  });

  // Check the redis whether the given key is available or not
  function isRedisKeyAvail(pKey, callback) {
    try {
      reqRedisInstance.GetRedisConnection(async function (error, pRedisClient) {
        if (error) {
          return printError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
        } else {
          // pRedisClient.exists(pKey, function (error, reply) {
          try {
            var reply = await pRedisClient.exists(pKey)
            // if (error) {
            //   printError(serviceName, objLogInfo, 'ERR-REF-230040', 'Error in isRedisKeyAvail function', error);
            // } else {
            if (reply === 1) {
              return callback(true);
            } else {
              printInfo(serviceName, pKey + ' Does not exists on Redis server', null);
              return callback(false);
            }
            // }
          } catch (error) {
            printError(serviceName, objLogInfo, 'ERR-REF-230039', 'Error in isRedisKeyAvail function', error);
          }
          // });
        }
      });
    } catch (error) {
      printError(serviceName, objLogInfo, 'ERR-REF-230038', 'Error in isRedisKeyAvail function', error);
    }
  }


  function getservicemodel() {
    var reqDBInstance = require('../instance/DBInstance');
    var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'].MODE;
    return serviceModel;
  }

  // Get value from redis server for the given key
  function getValue(pKey, pCallback) {
    try {
      reqRedisInstance.GetRedisConnection(async function (error, pRedisClient) {
        if (error) {
          printError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
          pCallback(0, error);
        } else {
          var indexDB = 0;
          if (pKey.indexOf('SESSIONID') > -1) {
            reqRedisInstance.GetRedisConnectionwithIndex(2, async function (error, RedisSession) {
              // RedisSession.exists(pKey, function (error, reply) {
              try {
                var reply = await RedisSession.exists(pKey)
                if (error) {
                  printError(serviceName, objLogInfo, 'ERR-REF-230038', 'Error in getConfig function', error);
                  pCallback(0, error);
                } else {
                  if (reply === 1) {
                    // RedisSession.get(pKey, function (error, reply) {
                    try {
                      var keyval = await RedisSession.get(pKey)
                      if (error) {
                        printError(serviceName, objLogInfo, 'ERR-REF-230039', 'Error in getConfig function', error);
                        pCallback(0, error);
                      } else {
                        pCallback(keyval.toString(), error);
                      }
                    } catch (error) {
                      printError(serviceName, objLogInfo, 'ERR-REF-230040', 'Error in getConfig function', error);
                      pCallback(0, error);
                    }
                    // });
                  } else {
                    printInfo(serviceName, 'Does not exists the ' + pKey + ' on Redis server', null);
                    pCallback(reply, error);
                  }
                }
              } catch (error) {
                printError(serviceName, objLogInfo, 'ERR-REF-230041', 'Error in getConfig function', error);
                pCallback(0, error);
              }
              // });
            });
          } else {
            try {
              var reply = await pRedisClient.exists(pKey)
              // pRedisClient.exists(pKey, function (error, reply) {

              if (error) {
                printError(serviceName, objLogInfo, 'ERR-REF-230037', 'Error in getConfig function', error);
                // check error type and reconnect the redis conneciton
                pCallback(0, error);
              } else {
                if (reply === 1) {
                  // pRedisClient.get(pKey, function (error, reply) {
                  var keyval = await pRedisClient.get(pKey)
                  try {
                    if (error) {
                      printError(serviceName, objLogInfo, 'ERR-REF-230036', 'Error in getConfig function', error);
                      pCallback(0, error);
                    } else {
                      pCallback(keyval.toString(), error);
                    }
                  } catch (error) {
                    printError(serviceName, objLogInfo, 'ERR-REF-230035', 'Error in getConfig function', error);
                    pCallback(0, error);
                  }
                  // });
                } else {
                  printInfo(serviceName, 'Does not exists the ' + pKey + ' on Redis server', null);
                  pCallback(reply, error);
                }
              }
            } catch (error) {
              printError(serviceName, objLogInfo, 'ERR-REF-230034', 'Error in getConfig function', error);
              pCallback(0, error);
            }
            // });
          }
        }
      });
    } catch (error) {
      printError(serviceName, objLogInfo, 'ERR-REF-230033', 'Error in getConfig function', error);
      pCallback(0, error);
    }
  }

  // Form Redis key from input routingkey
  function getRedisKey(pSchema, pRoutinKey, callback) {
    try {
      if (!pRoutinKey) {
        pRoutinKey = defaultRoutingKey;
      }
      var redisKey = pSchema + '~' + pRoutinKey;
      return callback(redisKey.toUpperCase());
    } catch (error) {
      printError(serviceName, objLogInfo, 'ERR-REF-230032', 'Error in getRedisKey function', error);
    }
  }

  // To print the error in console as well as produce error message to DB/Kafka
  function printError(pServiceName, pLogInfo, pErrorCode, pErrorMessage, pErrorObject) {
    if (!pServiceName) {
      pServiceName = "service_name_null "
    }
    var reqLogWriter = require('../log/trace/LogWriter');
    try {
      pErrorMessage = pErrorMessage + '\n ----------------------------------------------------------------------------------------------------------------------------\n';
      var now = reqMoment(new Date()).format('YYYY-MM-DD HH:mm:ss.SSSS');
      if (pErrorObject && pErrorObject.stack) {
        pErrorObject = pErrorObject ? pErrorObject : '';
        getPad(errPad, ' ', function (pad) {
          errKeyWord = errKeyWord + pad.substring(0, pad.length - errKeyWord.toString().length);
          getPad(serviceNamePad, ' ', function (pad) {
            pServiceName = pServiceName + pad.substring(0, pad.length - pServiceName.toString().length);
            console.error(colors.error(errKeyWord + ' : ' + now + ' ' + pServiceName + ' ' + pErrorCode + ' ' + pErrorObject.stack + ' ' + pErrorMessage));
            if (pLogInfo) {
              pLogInfo.SERVICE_NAME = pServiceName;
              reqLogWriter.TraceError(pLogInfo, pErrorObject.stack + '\n' + pErrorMessage, pErrorCode);
            }
          });
        });
      } else {
        getPad(errPad, ' ', function (pad) {
          errKeyWord = errKeyWord + pad.substring(0, pad.length - errKeyWord.toString().length);
          getPad(serviceNamePad, ' ', function (pad) {
            pServiceName = pServiceName + pad.substring(0, pad.length - pServiceName.toString().length);
            console.error(colors.error(errKeyWord + ' : ' + now + ' ' + pServiceName + ' ' + pErrorCode + ' ' + pErrorObject + ' ' + pErrorMessage));
            if (pLogInfo) {
              reqLogWriter.TraceError(pLogInfo, pErrorObject + '\n' + pErrorMessage, pErrorCode);
            }
          });
        });
      }
    } catch (error) {
      getPad(errPad, ' ', function (pad) {
        errKeyWord = errKeyWord + pad.substring(0, pad.length - errKeyWord.toString().length);
        getPad(serviceNamePad, ' ', function (pad) {
          pServiceName = pServiceName + pad.substring(0, pad.length - pServiceName.toString().length);
          console.error(colors.error(errKeyWord + ' : ' + now + ' ' + pServiceName + ' ' + pErrorObject));
        });
      });
    }
  }

  // To print the info message in console as well as produce info message to DB/Kafka
  function printInfo(pServiceName, pInfo, pLogInfo) {
    var reqLogWriter = require('../log/trace/LogWriter');
    var now = reqMoment(new Date()).format('YYYY-MM-DD HH:mm:ss.SSSS');
    try {
      getPad(errPad, ' ', function (pad) {
        infoKeyWord = infoKeyWord + pad.substring(0, pad.length - infoKeyWord.toString().length);
        getPad(serviceNamePad, ' ', function (pad) {
          pServiceName = pServiceName + pad.substring(0, pad.length - pServiceName.toString().length);
          console.log(infoKeyWord + ' : ' + now + ' ' + pServiceName + ' ' + pInfo);
          if (pLogInfo) {
            pLogInfo.SERVICE_NAME = pServiceName;
            reqLogWriter.TraceInfo(pLogInfo, pInfo);
          }
        });
      });
      reqLogWriter = null;
      now = null;
    } catch (error) {
      reqLogWriter = null;
      now = null;
      getPad(errPad, ' ', function (pad) {
        errKeyWord = errKeyWord + pad.substring(0, pad.length - errKeyWord.toString().length);
        getPad(serviceNamePad, ' ', function (pad) {
          pServiceName = pServiceName + pad.substring(0, pad.length - pServiceName.toString().length);
          console.log(colors.error(errKeyWord + ' : ' + now + ' ' + pServiceName + ' ' + error));
        });
      });
    }
  }

  // To print the warning in console as well as produce warning message to DB/Kafka
  function printWarn(pServiceName, pWarn, pLogInfo) {
    var reqLogWriter = require('../log/trace/LogWriter');
    try {
      var now = reqMoment(new Date()).format('YYYY-MM-DD HH:mm:ss.SSSS');
      getPad(errPad, ' ', function (pad) {
        warnKeyWord = warnKeyWord + pad.substring(0, pad.length - warnKeyWord.toString().length);
        getPad(serviceNamePad, ' ', function (pad) {
          pServiceName = pServiceName + pad.substring(0, pad.length - pServiceName.toString().length);
          console.log(colors.warn(warnKeyWord + ' : ' + ' ' + now + ' ' + pServiceName + ' ' + pWarn));
          if (pLogInfo) {
            pLogInfo.SERVICE_NAME = pServiceName;
            reqLogWriter.TraceWarning(pLogInfo, pWarn);
          }
        });
      });
    } catch (error) {
      getPad(errPad, ' ', function (pad) {
        errKeyWord = errKeyWord + pad.substring(0, pad.length - errKeyWord.toString().length);
        getPad(serviceNamePad, ' ', function (pad) {
          pServiceName = pServiceName + pad.substring(0, pad.length - pServiceName.toString().length);
          console.log(colors.error(errKeyWord + ' : ' + now + ' ' + pServiceName + ' ' + pErrorObject));
        });
      });
    }
  }

  function getPad(padCount, padChar, callback) {
    var pad = '';
    for (var j = 0; j < padCount; j++) {
      pad += padChar;
    }
    return callback(pad);
  }

  // To get all the redis keys currently availble in redis server
  function getAllRedisKeys(callback) {
    reqRedisInstance.GetRedisConnection(function (error, pRedisClient) {
      if (error) {
        return printError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
      } else {
        pRedisClient.keys('*', function (error, keys) {
          if (error) {
            return printError(serviceName, objLogInfo, 'ERR-REF-230031', 'Error in getAllRedisKeys function', error);
          } else {
            return callback(keys);
          }
        });
      }
    });
  }

  // Get a new unique uuid string
  function guid() {
    var uuid = require('node-uuid');
    return uuid.v1();
  }

  // To return keys as uppercase in given array
  function arrKeyToUpperCase(pArr, pLogInfo) {
    try {
      var arrForReturn = [];
      for (var i = 0; i < pArr.length; i++) {
        var obj = pArr[i];
        var objNew = new Object();
        for (var key in obj) {
          var strUpperCaseKey = key.toUpperCase();
          objNew[strUpperCaseKey] = obj[key];
        }
        arrForReturn.push(objNew);
      }
      obj = null;
      objNew = null;
      return arrForReturn;
    } catch (error) {
      printError(serviceName, pLogInfo, 'ERR-REF-230030', 'Error in arrKeyToUpperCase function', error);
      return null;
    }
  }
  // To return keys as lowercase in given array
  function ArrKeyToLowerCase(pArr, pLogInfo) {
    try {
      var arrForReturn = [];
      for (var i = 0; i < pArr.length; i++) {
        var obj = pArr[i];
        var objNew = new Object();
        for (var key in obj) {
          var strLowerCaseKey = key.toLowerCase();
          objNew[strLowerCaseKey] = obj[key];
        }
        arrForReturn.push(objNew);
      }
      return arrForReturn;
    } catch (error) {
      printError(serviceName, pLogInfo, 'ERR-REF-230030', 'Error in arrKeyToLowerCase function', error);
      return null;
    }
  }

  // To send response to client for the api request with particular structure 
  function sendResponse(pServiceName, pAppResponse, pResponseData, pLogInfo, pErrorCode, pErrorMessage, pErrorObject, pProcessStatus, pInformation) {
    var reqLogWriter = require('../log/trace/LogWriter');
    try {
      if (pLogInfo) {
        if (!pLogInfo.IS_RESPONSE_SEND && pLogInfo !== '') {
          pLogInfo.IS_RESPONSE_SEND = true;
        } else {
          return printError(pServiceName, null, 'ERR-REF-230029', 'Respose already sent', '');
        }
      }

      // var EnvMode = reqRedisInstance.GetEnvMode();

      var EnvMode = getservicemodel();
      var responseJson = {
        service_status: '',
        process_status: '',
        data: '',
        error_code: ''
      };
      if (pErrorObject || pErrorMessage) {
        // Error case
        if (EnvMode == "DEBUG") {
          responseJson.data = pErrorMessage + ' ' + pErrorObject;
        } else {
          printError(pServiceName, pLogInfo, pErrorCode, pErrorMessage, pErrorObject);
          responseJson.data = "Service Error";
        }
        responseJson.service_status = 'FAILURE';
        // responseJson.data = pErrorMessage + pErrorObject;
        if (pErrorCode) {
          responseJson.error_code = pErrorCode;
          printError(pServiceName, pLogInfo, pErrorCode, pErrorMessage, pErrorObject);
        } else {
          printError(pServiceName, pLogInfo, 'ERR-REF-230028', 'This error from server without error code', pErrorObject);
        }
      } else if (pResponseData) {
        // Success case if response send
        responseJson.service_status = 'SUCCESS';
        responseJson.data = pResponseData;
      } else if (pInformation) {
        // SUCCESS/FAILURE with information message - no response_data here
        responseJson.service_status = 'SUCCESS';
        printInfo(pServiceName, pInformation, pLogInfo);
        responseJson.data = pInformation;
      }

      // Assign Process Status
      if (pProcessStatus) {
        responseJson.process_status = pProcessStatus;
      } else {
        responseJson.process_status = responseJson.service_status;
      }

      // Assign Info
      if (pInformation) {
        printInfo(pServiceName, pInformation, pLogInfo);
        responseJson.Message = pInformation;
      }

      pAppResponse.setHeader('Content-Type', 'application/json');
      pAppResponse.send(responseJson);
      pResponseData = null;
      responseJson = null;
      pInformation = null;
      pErrorObject = null;
      pAppResponse = null;


      destroyConn(pServiceName, pLogInfo, () => {
        printInfo(pServiceName, 'Connection destroyed success', pLogInfo); //this is for to know api call end
      });

      //this is for to know api call end
      printInfo(pServiceName, 'API Call End\n\n-----------------------------------------------------------------------------------------------------------------------------------------\n', pLogInfo); //this is for to know api call end
      if (pLogInfo) {
        reqLogWriter.EventUpdate(pLogInfo);
      }
      // pLogInfo = null;
    } catch (error) {
      printError(pServiceName, pLogInfo, 'ERR-REF-230027', 'Error in SendResponse function', error);
      pResponseData = null;
      pInformation = null;
      pErrorObject = null;
      pLogInfo = null;
      responseJson = null;
      pAppResponse = null;
    }
  }

  function destroyConn(pServiceName, pLogInfo, pCallback) {
    var connlength = ''
    if (pLogInfo && pLogInfo.arrConns) {
      connlength = pLogInfo.arrConns.length;
      printInfo(pServiceName, 'Total knex connection created for the api call | ' + connlength, pLogInfo);
      reqAsync.forEachOfSeries(pLogInfo.arrConns, function (Conn, idx, callback) {
        try {
          if (Conn.destroy) {
            Conn.destroy((error, result) => {
              printInfo(pServiceName, 'Destroying connection - ' + (idx + 1) + '/' + connlength, pLogInfo);
              callback();
            });
          } else {
            callback();
          }
        } catch (error) {
          printInfo(pServiceName, 'Exception while destroying connection - ' + idx + 1 + '/- ' + connlength + error, pLogInfo);
        }
      }, function (error) {
        if (error) {
          printInfo(pServiceName, 'Error occured destroying connection', pLogInfo);
        }
        pLogInfo.arrConns = [];
        pCallback();
      });
    } else {
      printInfo(pServiceName, 'There is No Db Connection Available for destroying connection', pLogInfo);
      pCallback();
    }
  }


  // Common function for emit messages to socket - To be used in custom code
  function EmitSocketMessage(pSocketId, pMessagekey, pData, CallbackEmit) {
    try {
      var request = require('request');
      var inputJson = {
        SOCKET_ID: pSocketId,
        MESSAGE_KEY: pMessagekey,
        DATA: pData
      };

      // Get HA proxy url from redis
      getValue('NGINX_HAPROXY_URL', function CallbackRedis(result, error) {
        var postURL = JSON.parse(result).url.replace('microsvc', 'Socket/EmitMessage');
        var options = {
          url: postURL,
          method: "POST",
          headers: {
            'content-type': 'application/json'
          },
          body: inputJson
        };
        CallRequest(options, function (pResult) {
          console.log(' Feedback API call result ' + pResult);
          CallbackEmit(pResult);
        });

        function CallRequest(options, callback) {
          request({
            uri: options.url,
            method: 'POST',
            json: options.body,
          }, function (err, httpResponse, body) {
            if (err) {
              console.log('Error on CallRequest - ' + err);
              return callback('FAILURE');
            } else {
              console.log(httpResponse.statusCode, body);
              return callback('SUCCESS');
            }
          });
        }
      });
    } catch (error) {
      printError(pServiceName, null, 'ERR-REF-230027', 'Error in socket Emit message', error);
    }
  }

  function readConfigFile(callback) {
    // var reqConfig = require('../../config/config.json');
    // return callback(null, reqConfig);
    //var reqPath = require('path');
    var configPath = path.join(__dirname, '../../config/config.enc');
    fs.readFile(configPath, function (error, result) {
      if (error) {
        return callback(error);
      } else {
        var decrypted = reqEncryptionInstance.DecryptPassword(result.toString());
        return callback(null, JSON.parse(decrypted));
      }
    });
  }

  function getRedisValue(pKeyName, pHeaders, pCallback) { // verify where is this function used
    //serviceName = 'AppHelper.js getRedisValue()';
    try {
      var redisKey = pKeyName + '~' + (pHeaders['routingkey'] ? pHeaders['routingkey'].toUpperCase() : "");
      var redisKeyDefault = pKeyName + '~' + defaultRoutingKey.toUpperCase();
      reqRedisInstance.GetRedisConnection(async function (error, clientRedis) {
        if (error) {
          return printError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
        } else {
          // clientRedis.exists(redisKey, function (err, reply) {
          try {
            var reply = await clientRedis.exists(redisKey)
            if (reply === 1) {
              // clientRedis.get(redisKey, function (err, reply) {
              try {
                var redisvalue = await clientRedis.get(redisKey)
                pCallback(redisvalue.toString());
              } catch (error) {
                printError(serviceName, objLogInfo, 'ERR-REF-230008', 'Error in getRedisValue function', error);
              }
              // });
            } else {
              // clientRedis.exists(redisKeyDefault, function (err, replydefault) {
              try {
                var replydefault = await clientRedis.exists(redisKeyDefault)
                if (replydefault === 1) {
                  // clientRedis.get(redisKeyDefault, function (err, reply) {
                  try {
                    var redisvalue = await clientRedis.get(redisKeyDefault)
                    pCallback(redisvalue.toString());
                  } catch (error) {
                    printError(serviceName, objLogInfo, 'ERR-REF-230009', 'Error in getRedisValue function', error);
                  }
                  // });
                } else {
                  pCallback(null, null);
                }
              } catch (error) {
                printError(serviceName, objLogInfo, 'ERR-REF-230010', 'Error in getRedisValue function', error);
              }
              // });
            }
          } catch (error) {
            printError(serviceName, objLogInfo, 'ERR-REF-230011', 'Error in getRedisValue function', error);
          }
          // });
        }
      });
    } catch (error) {
      printError(serviceName, objLogInfo, 'ERR-REF-230038', 'Error in isRedisKeyAvail function', error);
    }

  }




  function restartSvc(objLogInfo) {
    try {
      global.DisconnInProgress = true;
      var ServiceInfo = null;
      var fileContent = {
        SERVICE_NAME: process.title,
        Date_And_Time: reqMoment(new Date()).format('YYYY-MM-DD    hh-mm-ss-SSSS A'),
        API_name: objLogInfo.ACTION || 'There is no API Name For This Process',
        Error: objLogInfo.RestartErrorObj || 'There is no Error Information For This Process'
      };
      var strFileContent = JSON.stringify(fileContent);;
      var headers = (objLogInfo && objLogInfo.headers) || {};
      headers.startWith = 'STOP_';
      headers.file_extension = '.json';
      var fileName = null;
      fileName = GetServiceFileName(headers);
      printError(serviceName, objLogInfo, 'ERR-KNEX', 'connection error', "\n\n\n--------------- restarting " + process.title + " service --------------- ");
      ServiceInfo = GetServiceInfo(process.title, 'Stop/');
      writeServiceLog(ServiceInfo.service_folder_path, fileName, strFileContent, function () { });
      restrt(ServiceInfo.pm2_service_restart_command);
      // else{
      //   printInfo(serviceName, "\n\n\n--------------- restarting IDE service ---------------", objLogInfo);
      //   shell.exec('pm2 restart app_cs')
      // }
    } catch (error) {
      console.log('------------------------- restart Error ' + error);
    }
  }

  function restrt(svcName) {
    setTimeout(() => {
      shell.exec(svcName);;
    }, 5000);
  }


  function writeServiceLog(pFolderPath, pFileName, pFileContent, writeServiceLogCB) {
    /*   ReqObj Optional Parameters are below
        - pFolderPath  -  service_logs/ 
        - pFileName    -  Name Of the File 
        - pFileContent - Content to write the File*/
    try {
      var fileWritingStatus = {};
      var objLogInfo = {};
      console.log('~~~~~~~~~~~~~~~~ writeServiceLog started');
      var folderReqObj = {
        destination_folder_path: pFolderPath,
        objLogInfo
      };
      DynamicFolderCreationwithCallback(folderReqObj, function () {
        fs.readFile(pFolderPath + pFileName, 'utf8', (error, data) => {
          if (data == undefined) {
            data = '';
            console.log('File Content Empty');
          }
          pFileContent = data + pFileContent;
          console.log('~~~~~~~~~~~~~~~~ write file started');
          fs.writeFile(pFolderPath + pFileName, pFileContent, function (err) {
            console.log('~~~~~~~~~~~~~~~~ write file Ended');
            if (err) {
              fileWritingStatus.status = false;
              fileWritingStatus.error = err;
            } else {
              fileWritingStatus.status = true;
              fileWritingStatus.error = null;
            }
            console.log('File Created with given content!');
            if (writeServiceLogCB) {
              writeServiceLogCB(fileWritingStatus);
            }
          });
        });
      });
    } catch (error) {
      printError(serviceName, objLogInfo, 'ERR-REF-230051', 'Catch Error in writeServiceLog()...', error);
      if (writeServiceLogCB) {
        writeServiceLogCB(fileWritingStatus);
      }
    }
  }


  function GetServiceFileName(pHeader) {
    /*   ReqObj Optional Parameters are below
       - startWith
       - file_extension */
    var fileName_start_with = 'ERR_';
    var file_extension = '.log';
    if (!pHeader) {
      return fileName_start_with + reqMoment(new Date()).format('YYYY-MM-DD    hh-mm-ss-SSSS A') + file_extension;
    } else if (pHeader.startWith) {
      fileName_start_with = pHeader.startWith;
      file_extension = pHeader.file_extension;
      return fileName_start_with + reqMoment(new Date()).format('YYYY-MM-DD    hh-mm-ss-SSSS A') + file_extension;
    } else if (pHeader.file_extension) {
      file_extension = pHeader.file_extension;
      return fileName_start_with + reqMoment(new Date()).format('YYYY-MM-DD    hh-mm-ss-SSSS A') + file_extension;
    } else if (pHeader) {
      return 'ERR_' + reqDateFormatter.ConvertDate(new Date(), pHeader, null, 'YYYY-MM-DD    hh-mm-ss-SSSS A') + file_extension;
    }
  }


  function CheckServiceLogFiles(pInputRequest, pObjLogInfo, CheckServiceLogFilesCB) {
    try {
      /*   pInputRequest Should contains Following
        - Service_Log_Folder_Path
        - pObjLogInfo */
      var serviceLogFolderPath = pInputRequest.Service_Log_Folder_Path;
      var errorFiles = [];
      fs.readdir(serviceLogFolderPath, function (err, files) {
        printInfo(serviceName, 'Reading Folder Path - ' + serviceLogFolderPath, pObjLogInfo);
        if (err) {
          // console.log('Error in CheckServiceLogFiles() Fs.readdir();', err);
          CheckServiceLogFilesCB(errorFiles);
        } else {
          for (var a = 0; a < files.length; a++) {
            if ((files[a]).startsWith('ERR_')) {
              var fileObj = {
                file_name: files[a]
              };
              errorFiles.push(fileObj);
            }
          }
          CheckServiceLogFilesCB(errorFiles);
        }
      });

    } catch (error) {
      printError(serviceName, pObjLogInfo, 'ERR-REF-230052', 'Catch Error in CheckServiceLogFiles()...', error);
      CheckServiceLogFilesCB(errorFiles);
    }
  }

  function ReadingServiceLogFile(pFileObj, pObjLogInfo, ReadingServiceLogFileCB) {
    /*   pFileObj Should contains Following
         - file_path  [File Source] - service_logs/Your_file_name
         
          */
    try {
      fs.readFile(pFileObj.file_path, 'utf8', (error, data) => {
        if (error) {
          console.log('Error while getting File Content and Error - ' + error);
          return ReadingServiceLogFileCB(false);
        };
        if (!data) {
          console.log('File Content Empty');
          return ReadingServiceLogFileCB(true);
        }
        var actualFileContent = JSON.parse(data);
        return ReadingServiceLogFileCB(actualFileContent);
      });
    } catch (error) {
      printError(serviceName, pObjLogInfo, 'ERR-REF-230053', 'Catch Error in ReadingServiceLogFile()...', error);
      return ReadingServiceLogFileCB(false);
    }

  }


  function RenameServiceLogFile(srcPath, desPath, RenameServiceLogFileCB) {
    /*   ReqObj Should contains Following
       - srcPath - [Data Type as String] [File Source] - service_logs/Your_file_name
       - srcPath - [Data Type as Object] {src_file_path: 'service_logs/Your_file_name',destination_folder_path : 'service_logs/processed/Your_New_File_Name'}
       - desPath [File Renaming Path] - service_logs/processed/Your_New_File_Name
       
        */
    try {
      var objLogInfo = {};
      if (typeof srcPath == 'object') {
        objLogInfo = srcPath.objLogInfo;
        var folderReqObj = {
          destination_folder_path: srcPath.destination_folder_path,
          objLogInfo
        };
        DynamicFolderCreation(folderReqObj);
        srcPath = srcPath.src_file_path;
      }
      fs.rename(srcPath, desPath, function () {
        // To Check Whether the Old File Is Present or not by its SRC File Path 
        if (fs.existsSync(srcPath)) {
          // To Remove the Old Source Files by using its SRC File Path 
          fs.unlink(srcPath, function () {
            RenameServiceLogFileCB();
          });
        } else {
          RenameServiceLogFileCB();
        }
      });
    } catch (error) {
      printError(serviceName, objLogInfo, 'ERR-REF-230053', 'Catch Error in ReadingServiceLogFile()...', error);
      RenameServiceLogFileCB();
    }

  }


  function GetServiceInfo(processTitle, folderName, GetServiceInfoCB) {
    /*   ReqObj Should contains Following
       - folderName
       - processTitle
   
        */
    try {
      var objLogInfo = {};
      var serviceInfo = {
        service_folder_path: '',
        pm2_service_name: ''
      };
      if (processTitle == 'Torus_Bg_AttachmentConsumer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/consumer/attachmentconsumer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'attachmentconsumer_1.0';
      } else if (processTitle == 'Torus_Bg_CommunicationConsumer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/consumer/CommunicationConsumer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'CommunicationConsumer_1.0';
      } else if (processTitle == 'Torus_Bg_TranVersionDetailConsumer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/consumer/tranversiondetailconsumer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'tranversiondetailconsumer_1.0';
      } else if (processTitle == 'Torus_Bg_FxTranConsumer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/consumer/fxtranconsumer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'fxtranconsumer_1.0';
      } else if (processTitle == 'Torus_Svc_Analytics') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/api/analytics/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'analytics_1.0';
      } else if (processTitle == 'Torus_Svc_Audit') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/api/audit/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'audit_1.0';
      } else if (processTitle == 'Torus_Svc_Authentication') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/api/authentication/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'authentication_1.0';
      } else if (processTitle == 'Torus_Svc_Communication') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/api/communication/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'communication_1.0';
      } else if (processTitle == 'Torus_Svc_Exchange') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/api/exchange/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'exchange_1.0';
      } else if (processTitle == 'Torus_Svc_Handler') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/api/handler/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'handler_1.0';
      } else if (processTitle == 'Torus_Svc_MiniGoverner') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/api/minigoverner/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'minigoverner_1.0';
      } else if (processTitle == 'Torus_Svc_Transaction') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/api/transaction/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'transaction_1.0';
      } else if (processTitle == 'Torus_Svc_Resource') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/api/resource/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'resource_1.0';
      } else if (processTitle == 'Torus_Bg_EmailScan') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/consumer/emailscan/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'emailscan_1.0';
      } else if (processTitle == 'Torus_Bg_AtmtDataProducer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/producer/atmt-dataproducer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'atmtdataproducer_1.0';
      } else if (processTitle == 'Torus_Bg_AuditDataProducer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/producer/audit-dataproducer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'audit-dataproducer.0';
      } else if (processTitle == 'Torus_Bg_PrctProducer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/producer/prct-dataproducer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'prct-dataproducer_1.0';
      } else if (processTitle == 'Torus_Bg_TranDataProducer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/producer/tran-dataproducer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'trandataproducer_1.0';
      } else if (processTitle == 'Torus_Svc_Report') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/api/report/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'report_1.0';
      } else if (processTitle == 'Torus_Svc_Scan') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/api/scan/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'scan_1.0';
      } else if (processTitle == 'Torus_Svc_Scheduler') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/api/scheduler/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'scheduler_1.0';
      } else if (processTitle == 'Torus_Svc_Validation') {
        serviceInfo.service_folder_path = '../../../torus-services/api/validation/service_logs/' + folderName;
        serviceInfo.pm2_service_name = 'validation_1.0';
      } else if (processTitle == 'Torus_Bg_APCP-OTPConsumer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/consumer/apcp-otpconsumer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'apcp-otpconsumer_1.0';
      } else if (processTitle == 'Torus_Bg_AuditLogConsumer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/consumer/auditlogconsumer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'auditlogconsumer_1.0';
      } else if (processTitle == 'Torus_Bg_LogConsumer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/consumer/logconsumer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'logconsumer_1.0';
      } else if (processTitle == 'Torus_Bg_PrctConsumer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/consumer/prctconsumer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'prctconsumer_1.0';
      } else if (processTitle == 'Torus_Bg_SaveAtmtConsumer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/consumer/saveattachmentconsumer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'saveattachmentconsumer_1.0';
      } else if (processTitle == 'Torus_Bg_SaveTranConsumer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/consumer/savetranconsumer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'savetranconsumer_1.0';
      } else if (processTitle == 'Torus_Bg_SocketConsumer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/consumer/socket/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'socket_1.0';
      } else if (processTitle == 'Torus_Bg_WP-OTPConsumer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/consumer/wp-otpconsumer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'wpotpconsumer_1.0';
      } else if (processTitle == 'Torus_Svc_Archival') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/api/archival/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'archival_1.0';
      } else if (processTitle == 'Torus_Bg_CommMessageSenderConsumer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/consumer/commmessagesenderconsumer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'commmessagesenderconsumer_1.0';
      } else if (processTitle == 'Torus_Bg_CommProcessDataConsumer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/consumer/commprocessdataconsumer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'commprocessdataconsumer_1.0';
      } else if (processTitle == 'Torus_Bg_CommProcessMsgFailureConsumer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/consumer/commprocessmsgfailureconsumer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'commprocessmsgfailureconsumer_1.0';
      } else if (processTitle == 'Torus_Bg_CommProcessMsgSuccessConsumer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/consumer/commprocessmsgsuccessconsumer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'commprocessmsgsuccessconsumer_1.0';
      } else if (processTitle == 'Torus_Bg_TranJourneyConsumer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/consumer/tranjourneyconsumer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'tranjourneyconsumer_1.0';
      } else if (processTitle == 'Torus_Svc_DevopsService') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/api/devopsservice/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'devopsservice_1.0';
      } else if (processTitle == 'Torus_Bg_TRANJourneyDetailProducer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/producer/tranjourney-detailproducer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'tranjourneydetailproducer_1.0';
      } else if (processTitle == 'Torus_Bg_HSTFXTableDataProducer') {
        serviceInfo.service_folder_path = path.join(__dirname, '../../torus-services/bgprocess/producer/fxtable-dataproducer/service_logs/' + folderName);
        serviceInfo.pm2_service_name = 'hstfxtabledataproducer_1.0';
      }
      else {
        printInfo(serviceName, "\n\n\n--------------- restarting IDE service ---------------", objLogInfo);
        // serviceInfo.service_folder_path = '../../../torus-services/ide_projects/service_logs/' + folderName;
        serviceInfo.pm2_service_name = 'app_cs';
      }
      serviceInfo.pm2_service_restart_command = 'pm2 restart ' + serviceInfo.pm2_service_name;
      return serviceInfo;
    } catch (error) {
      // serviceInfo.service_folder_path = '../../../torus-services/Catch_Error/service_logs/' + folderName;
      serviceInfo.pm2_service_restart_command = 'pm2 restart ' + serviceInfo.pm2_service_name;
      printError(serviceName, objLogInfo, 'ERR-REF-230054', 'Catch Error in GetServiceInfo()...', error);
      return serviceInfo;
    }
  }


  // Used to Create Folder, If The Folder Path Is Not Present
  function DynamicFolderCreation(pReqObj) {
    /*   ReqObj Optional Parameters are below
       - destination_folder_path - service_logs/
       - objLogInfo */
    try {
      var destFolderPath = pReqObj.destination_folder_path || undefined;
      var objLogInfo = pReqObj.objLogInfo || {};
      if (destFolderPath && !fs.existsSync(destFolderPath)) {
        var fullPathSplit = destFolderPath.split('/');
        var fullPath = '';
        for (var a = 0; a < fullPathSplit.length; a++) {
          fullPath = fullPath + fullPathSplit[a] + '/';
          if (!fullPathSplit[a].startsWith('.') && !fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath);
          }
        }
      }
    } catch (error) {
      printError(serviceName, objLogInfo, 'ERR-REF-230050', 'Catch Error in DynamicFolderCreation()...', error);
    }
  }



  function DynamicFolderCreationwithCallback(pReqObj, pCallback) {
    try {
      var destFolderPath = pReqObj.destination_folder_path || undefined;
      var objLogInfo = pReqObj.objLogInfo || {};
      if (destFolderPath && !fs.existsSync(destFolderPath)) {
        fs.mkdir(destFolderPath, { recursive: true }, (err) => {
          if (err) {
            console.log(err, '===========');
          }
          pCallback();
        });
      } else {
        pCallback();
      }
    } catch (error) {
      console.log(error, '====== Catch Error=====');
      pCallback();
    }
  };

  function GetRedisServiceParamConfig(params, GetRedisServiceParamConfigCB) {
    try {
      /* Input Params are
     - SERVICE_NAME
     - objLogInfo  
     */
      var serviceParamRedisKey = 'SERVICE_PARAMS';
      // Getting the Service params based on the Service Name from the Redis
      getValue(serviceParamRedisKey, function (serviceParamRedisKeyValue, error) {
        // printInfo(serviceName, 'Redis Key - ' + serviceParamRedisKey + ' Redis Value - ' + serviceParamRedisKeyValue, objLogInfo);
        if (serviceParamRedisKeyValue) {
          try {
            ServiceParamsSession = JSON.parse(serviceParamRedisKeyValue);
          } catch (error) {
            printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0026', 'Error While Parsing a SERVICE_PARAMS Redis Value..Please Check SERVICE_PARAMS Redis Key ', error);
          }
          if (params && params.SERVICE_NAME) {
            try {
              serviceParamRedisKeyValue = JSON.parse(serviceParamRedisKeyValue)[params.SERVICE_NAME];
            } catch (error) {
              printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0027', 'Error While Parsing a SERVICE_PARAMS Redis Value Based on Its SERVICE_NAME. Please Check SERVICE_PARAMS Redis Key ', error);
            }
            GetRedisServiceParamConfigCB(null, serviceParamRedisKeyValue);
          } else {
            GetRedisServiceParamConfigCB(null, serviceParamRedisKeyValue);
          }
        } else {
          GetRedisServiceParamConfigCB('There is No Redis Config', null);
        }
      });


    } catch (error) {
      printError(serviceName, objLogInfo, 'ERR_SERVICE_PARAM_CONFIG_0003', 'Catch Error in GetRedisServiceParamConfig()...', error);
      GetRedisServiceParamConfigCB(error, null);
    }
  }


  function DoRedisSetnx(params, DoRedisSetnxCB) {
    try {
      /* params should Contains
      - DB
      - TTL
      - KEY 
      - NEED_SETNX
      - VALUE 
      - objLogInfo */

      if (params.DB && params.TTL && params.KEY) {
        reqRedisInstance.GetRedisConnectionwithIndex(params.DB, async function (error, redis_instance) {
          if (error) {
            printError(serviceName, params.objLogInfo, 'ERR_DOREDISSETNX_0002', 'Error While Getting Redis Connection with Index - ' + params.DB, error);
            DoRedisSetnxCB(error, null);
          }
          else {
            if (params.NEED_SETNX) {
              // redis_instance.set(params.KEY, JSON.stringify(params.VALUE), 'NX', 'EX', params.TTL, function (error, result) {
              reqRedisInstance.RedisSetNx(redis_instance, params.KEY, JSON.stringify(params.VALUE), params.TTL, function (result) {
                if (result) {
                  printInfo(serviceName, 'Redis Key - ' + params.KEY + ' Added Successfully', params.objLogInfo);
                  DoRedisSetnxCB(null, true);
                } else {
                  printInfo(serviceName, 'Redis Key - ' + params.KEY + ' Already Existed', params.objLogInfo);
                  DoRedisSetnxCB(null, false);
                }
              });
            } else {
              printInfo(serviceName, 'Extending The Redis Key TTL' + params.KEY, params.objLogInfo);
              await redis_instance.set(params.KEY, JSON.stringify(params.VALUE), 'EX', params.TTL);
              DoRedisSetnxCB(null, true);
            }
          }
        });
      } else {
        var errorMsg = 'Plz Check Redis DB, TTL and KEY From Your Config';
        printError(serviceName, params.objLogInfo, 'ERR_DOREDISSETNX_0004', errorMsg, '');
        DoRedisSetnxCB(errorMsg, null);
      }
    } catch (error) {
      printError(serviceName, params.objLogInfo, 'ERR_DOREDISSETNX_0001', 'Catch Error in DoRedisSetnx()', error);
      DoRedisSetnxCB(error, null);
    }
  }

  // Need To remove Because Same Logic is applied with help of another function
  function CheckIdleTimeAndRestart(checkIdleTimeAndRestartParams, objLogInfo, CheckIdleTimeAndRestartCB) {
    /*  should contains
     - MAX_IDLE_TIME
     - PROCESS_START_TIME */

    try {
      checkIdleTimeAndRestartParams = (checkIdleTimeAndRestartParams && JSON.parse(checkIdleTimeAndRestartParams)) || {};
      var maxIdleTime = checkIdleTimeAndRestartParams.MAX_IDLE_TIME;
      var processStartTime = checkIdleTimeAndRestartParams.PROCESS_START_TIME;
      printInfo(serviceName, 'Redis Maximum Idle Time - ' + maxIdleTime + ' Seconds', objLogInfo);

      if (processStartTime) {
        var timeDiff = (new Date().getTime() - new Date(processStartTime).getTime()) / 1000; // Convert Milli Seconds into Seconds
        printInfo(serviceName, 'Current Idle Time - ' + timeDiff + ' Seconds', objLogInfo);
        if (maxIdleTime <= timeDiff) {
          printInfo(serviceName, 'Processing Time Exceeds the Maximum Idle Time', objLogInfo);
          printInfo(serviceName, 'Going to Restart the Service...', objLogInfo);
          var reqLogWriter = require('../log/trace/LogWriter');
          reqLogWriter.EventUpdate(objLogInfo);
          restartSvc(objLogInfo);
        }
      } else {
        printInfo(serviceName, 'Process Start Time - ' + processStartTime, objLogInfo);
      }
      CheckIdleTimeAndRestartCB();
      checkIdleTimeAndRestartParams = '';
    } catch (error) {
      printError(serviceName, objLogInfo, 'ERR-CHECKIDLETIMEANDRESTART-0008', 'Catch Error in CheckIdleTimeAndRestart()...', error);
      CheckIdleTimeAndRestartCB();
      checkIdleTimeAndRestartParams = '';
    }

  }


  // To Verify and Restart the Service Based on the Redis Maximum Memory
  // Temporary Code For Memory Leak
  function CheckMemoryAndIdleTime(params, CheckMemoryAndIdleTimeCB) {
    try {
      /*  should contains
    - objLogInfo
    - MAX_IDLE_TIME
    - PROCESS_START_TIME
    - CONSUMER_ALLTHREAD_INFO
    - MSG_PROCESSED_COUNT
    - MAX_RETRY_COUNT
    - MAX_RETRY_INTERVAL
    - MAX_RETRY_ERROR_LIST
    - RESTART_FLAG
    - CURRENT_TOPIC
    - MAX_MEMORY_SIZE
    - NEED_RESTART
     */
      var objLogInfo = params.objLogInfo
      var maxIdleTime = params.MAX_IDLE_TIME
      var needRestart = params.NEED_RESTART
      var processStartTime = params.PROCESS_START_TIME
      var currentThreadInfo = params.CURRENT_THREAD_INFO;
      var consumerAllThreadInfo = params.CONSUMER_ALLTHREAD_INFO;
      var processedMsgCount = params.MSG_PROCESSED_COUNT
      // var redisMaxRetryCount = params.MAX_RETRY_COUNT
      // var redisMaxRetryInterval = params.MAX_RETRY_INTERVAL
      // var redisRetryErrorList = params.MAX_RETRY_ERROR_LIST || [];
      var restartFlag = params.RESTART_FLAG
      var maxMemorySize = params.MAX_MEMORY_SIZE
      // var currentTopic = params.CURRENT_TOPIC
      // printInfo(serviceName, 'Current Thread Topic - ' + currentTopic, objLogInfo);
      printInfo(serviceName, 'Total Processed Message Count - ' + processedMsgCount, objLogInfo);
      // printInfo(serviceName, 'Maximum Memory Size - ' + maxMemorySize + ' MB', objLogInfo);
      var currentMemorySize = (process.memoryUsage().rss) / (1024 * 1024);
      printInfo(serviceName, 'Current Memory Size - ' + currentMemorySize + ' MB', objLogInfo);
      // printInfo(serviceName, 'Restart Flag - ' + restartFlag, objLogInfo);

      if (maxIdleTime) {
        // Service Idle Time Case

        // printInfo(serviceName, 'Redis Maximum Idle Time - ' + maxIdleTime + ' Seconds', objLogInfo);

        if (processStartTime) {
          var timeDiff = (new Date().getTime() - new Date(processStartTime).getTime()) / 1000; // Convert Milli Seconds into Seconds
          // printInfo(serviceName, 'Current Idle Time - ' + timeDiff + ' Seconds', objLogInfo);
          if (maxIdleTime <= timeDiff) {
            printInfo(serviceName, 'Processing Time Exceeds the Maximum Idle Time', objLogInfo);

            if (needRestart) {
              printInfo(serviceName, 'So Going to Restart the Service', objLogInfo);
              var reqLogWriter = require('../log/trace/LogWriter');
              reqLogWriter.EventUpdate(objLogInfo);
              restartSvc(objLogInfo);
              reqLogWriter = '';

            } else {
              printInfo(serviceName, 'Going to Reset IsDone Varibale For Thread - ' + currentThreadInfo.topic, objLogInfo);
              currentThreadInfo.isDone = true; // Resetting 
            }
          }
        } else {
          printInfo(serviceName, 'Process Start Time - ' + processStartTime, objLogInfo);
        }
        CheckMemoryAndIdleTimeCB(null, true);
      } else {
        // Service Memory Case

        // if (redisMaxRetryCount) {
        //   printInfo(serviceName, 'Redis Maximum Retry Count - ' + redisMaxRetryCount, objLogInfo);
        // }
        // if (redisMaxRetryInterval) {
        //   printInfo(serviceName, 'Redis Retry Interval - ' + redisMaxRetryInterval + ' Sec', objLogInfo);
        // }
        // if (redisRetryErrorList) {
        //   printInfo(serviceName, 'Redis Retry Error List - ' + redisRetryErrorList.toString(), objLogInfo);
        // }
        if (restartFlag && currentMemorySize > maxMemorySize) {
          var isAllThreadProcessCompleted = true;
          for (let g = 0; g < consumerAllThreadInfo.length; g++) {
            const element = consumerAllThreadInfo[g];
            // Checking whether all thread processes are completed
            if (!element.isDone) {
              // Process Not Completed
              isAllThreadProcessCompleted = false;
              printInfo(serviceName, element.topic + ' - Process is Not Completed and Service Will not be going to Restart...', objLogInfo);
            }
          }
          if (isAllThreadProcessCompleted) {
            printInfo(serviceName, 'Maximum Memory Exceeded, So Going to Restart the Service', objLogInfo);
            var reqLogWriter = require('../log/trace/LogWriter');
            reqLogWriter.EventUpdate(objLogInfo);
            restartSvc(objLogInfo);
            reqLogWriter = '';
          } else {
            printInfo(serviceName, 'Process is Not Completed in some other thread, so waiting to complete the remaining process', objLogInfo);
            printInfo(serviceName, 'Thread Informations - ' + JSON.stringify(consumerAllThreadInfo), objLogInfo);
            // For this Case No Need to Send Callback because already Max Memory Exceeded, so waiting for the incomplte thread to complete.
          }
        } else {
          CheckMemoryAndIdleTimeCB(null, true);
        }
      }
    } catch (error) {
      CheckMemoryAndIdleTimeCB(error, null);
    }
  }


  // Used to Replace the Scpecial charc from Redis
  function ReplaceSpecialCharacter(jsonString, replaceSpecialChar) {
    try {
      var replacedJson = jsonString;
      replacedJson = replacedJson.replace(/","/g, 'json_quotes');
      replacedJson = replacedJson.replace(/\\\"/g, 'slash_doublequotes');
      replacedJson = replacedJson.replace(/\\/g, '\\\\');
      replacedJson = JSON.stringify(replacedJson);

      // Removing Duplicate Entries
      replaceSpecialChar = replaceSpecialChar.filter(function (elem, pos) {
        var index = replaceSpecialChar.indexOf(elem.trim());
        return (index == pos || index == -1);
      });

      for (let z = 0; z < replaceSpecialChar.length; z++) {
        var element = replaceSpecialChar[z];
        if (element) {
          element = element.trim();
          var specialchar = '\\\\' + element;
          replacedJson = replacedJson.replace(new RegExp(specialchar, 'g'), '\\\\' + element);
        }
      }

      replacedJson = JSON.parse(replacedJson);
      replacedJson = replacedJson.replace(/slash_doublequotes/g, '\\\"');
      replacedJson = replacedJson.replace(/json_quotes/g, '","');
      jsonString = replacedJson; // Replacing the Successfully altered Json
    } catch (error) {
      console.log('Catch Error in ReplaceSpecialCharacter();', error)
    }
    finally {
      //  if there is any catch error occurs, then it will return the json without any modification
      return jsonString;
    }
  }

  // Get the FX db Routing Keys list from redis to know the Timezone Informations based on the TENANT
  // Used While Calling kafka Producers
  function GetAllUniqueFxDBKeys(params, GetAllUniqueFxDBKeysCB) {
    try {
      /* params Should Contains
      objLogInfo
   
      */
      var uniqueFxDBRoutingKeys = [];
      var objLogInfo = params.objLogInfo;
      reqRedisInstance.GetRedisConnection(async function (error, redis_instance) {
        try {
          if (error) {
            printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0011', 'Error in GetRedisConnection()...', error);
            GetAllUniqueFxDBKeysCB(error, uniqueFxDBRoutingKeys);
          } else {
            try {
              // redis_instance.keys('*', function (error, arrAllRedisKeys) {
              var arrAllRedisKeys = await redis_instance.keys('*')
              var reqDBInstance = require('../instance/DBInstance');
              var serviceModel = reqDBInstance.DBInstanceSession.SERVICE_MODEL;
              if (!serviceModel) {
                printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0013', 'Service Model is Not Available...', '');
              } else {
                printInfo(serviceName, 'SERVICE_MODEL Info | ' + JSON.stringify(serviceModel), objLogInfo);
              }
              var connStr = serviceModel.TRANDB;
              printInfo(serviceName, 'Redis Key Filter | ' + connStr, objLogInfo);
              var arrFxDBKeys = [];
              for (let c = 0; c < arrAllRedisKeys.length; c++) {
                const element = arrAllRedisKeys[c];
                if ((element.indexOf(connStr) != -1)) {
                  // if ((element.indexOf(connStr) != -1 && element == connStr + '~AWS') || (element.indexOf(connStr) != -1 && element == connStr + '~VPH')) {
                  arrFxDBKeys.push(element);
                }
              }

              var i = 0;
              if (arrFxDBKeys.length) {
                doWithCurrentKey(arrFxDBKeys[i]);
              } else {
                printInfo(serviceName, 'No Fx DB Key Found', objLogInfo);
                printInfo(serviceName, 'End', objLogInfo);
                GetAllUniqueFxDBKeysCB(null, uniqueFxDBRoutingKeys);
              }

              // Checking Whether all the DBs Keys having Same Oracle Credentials
              function doWithCurrentKey(currentKey) {
                try {
                  i++;
                  getValue(currentKey, function (currJson, error) {
                    printInfo(serviceName, "currentKey  - " + currentKey, objLogInfo);
                    if (error) {
                      printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0014', 'Error in doWithCurrentKey() - getValue() Callback...', error);
                      if (i < arrFxDBKeys.length) {
                        doWithCurrentKey(arrFxDBKeys[i]);
                      } else {
                        reqLogWriter.EventUpdate(objLogInfo);
                        GetAllUniqueFxDBKeysCB(null, uniqueFxDBRoutingKeys);
                      }
                    } else {
                      var isChildRunning = checkChildRunning(currJson);
                      if (!isChildRunning) {
                        var routingkey = currentKey.replace(connStr + '~', '').toUpperCase();
                        if (uniqueFxDBRoutingKeys.indexOf(routingkey) == -1) {
                          uniqueFxDBRoutingKeys.push(routingkey);
                        }
                        // arrRunningChilds.push(currJson); // To Collect all the Tenants
                        if (i < arrFxDBKeys.length) {
                          doWithCurrentKey(arrFxDBKeys[i]);
                        } else {
                          GetAllUniqueFxDBKeysCB(null, uniqueFxDBRoutingKeys);
                        }
                      } else {
                        printInfo(serviceName, currentKey + ' is already running', objLogInfo);
                        if (i < arrFxDBKeys.length) {
                          doWithCurrentKey(arrFxDBKeys[i]);
                        } else {
                          printInfo(serviceName, 'End', objLogInfo);
                          GetAllUniqueFxDBKeysCB(null, uniqueFxDBRoutingKeys);
                        }
                      }
                    }
                  });
                } catch (error) {
                  printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0019', 'Catch Error in doWithCurrentKey()...', error);
                  GetAllUniqueFxDBKeysCB(error, uniqueFxDBRoutingKeys);
                }
              }

              var arrRunningChilds = [];

              // Checking the Current DB Info with Previous DB Info
              function checkChildRunning(jsonToStart) {
                for (var i = 0; i < arrRunningChilds.length; i++) {
                  var runningJson = arrRunningChilds[i];
                  try {
                    runningJson = JSON.parse(runningJson);
                    jsonToStart = JSON.parse(jsonToStart);
                    var currentServerInfo = jsonToStart.Server + '_' + jsonToStart.Port + '_' + jsonToStart.UserID;
                    var runningServerInfo = runningJson.Server + '_' + runningJson.Port + '_' + runningJson.UserID;

                  } catch (error) {
                    printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0015', 'Catch Error While Comparing currentServerInfo with runningServerInfo', error);
                  }
                  printInfo(serviceName, 'RUNNINGSERVERINFO - ' + runningServerInfo + ' and CURRENTSERVERINFO - ' + currentServerInfo, objLogInfo);
                  if (runningServerInfo == currentServerInfo) {
                    return true;
                  }
                }
                return false;
              }
              // }
            } catch (error) {
              printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0016', 'Catch Error in clientRedis.keys() Callback...', error);
              GetAllUniqueFxDBKeysCB(error, uniqueFxDBRoutingKeys);
            }
            // });
          }
        } catch (error) {
          printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0017', 'Catch Error in GetRedisConnection() Callback...', error);
          GetAllUniqueFxDBKeysCB(error, uniqueFxDBRoutingKeys);
        }
      });
    } catch (error) {
      printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0018', 'Catch Error in produceWithAllTranDBKeys()...', error);
      GetAllUniqueFxDBKeysCB(error, uniqueFxDBRoutingKeys);
    }

  }




  // Get the TRAND db list from redis to create a child process thread for each
  // Used While Calling kafka Consumers and Producers Services
  function GetAllUniqueTranDBKeys(params, GetAllUniqueTranDBKeysCB) {
    try {
      /* params Should Contains
      objLogInfo
   
      */
      var uniqueTranDBRoutingKeys = [];
      var is_tenantMultiThreaded = false;
      var objLogInfo = params.objLogInfo;
      reqRedisInstance.GetRedisConnection(async function (error, redis_instance) {
        try {
          if (error) {
            printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0001', 'Error in GetRedisConnection()...', error);
            GetAllUniqueTranDBKeysCB(error, uniqueTranDBRoutingKeys, is_tenantMultiThreaded);
          } else {
            var redisKey = 'SERVICE_PARAMS';
            // redis_instance.get(redisKey, async function (error, response) {
            var response = await redis_instance.get(redisKey)
            response = response && JSON.parse(response) || '';
            if (!response || (response && !response.IS_TENANT_MULTI_THREADED)) {
              is_tenantMultiThreaded = false;
              printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0010', 'IS_TENANT_MULTI_THREADED is not Enabled in Service Params', '');
            } else {
              printInfo(serviceName, 'IS_TENANT_MULTI_THREADED is Enabled', objLogInfo);
              is_tenantMultiThreaded = true;
            }
            try {
              var arrAllRedisKeys = await redis_instance.keys('*')
              var connStr = 'TRANDB';
              var arrTranDBKeys = [];
              for (let c = 0; c < arrAllRedisKeys.length; c++) {
                const element = arrAllRedisKeys[c];
                if ((element.indexOf(connStr) != -1)) {
                  // For Development
                  // if ((element.indexOf(connStr) != -1 && element == connStr + '~AWS') || (element.indexOf(connStr) != -1 && element == connStr + '~VPH')) {
                  arrTranDBKeys.push(element);
                }
              }

                var i = 0;
                if (arrTranDBKeys.length) {
                  doWithCurrentKey(arrTranDBKeys[i]);
                } else {
                  printInfo(serviceName, 'No TRANDB Key Found', objLogInfo);
                  printInfo(serviceName, 'End', objLogInfo);
                  GetAllUniqueTranDBKeysCB('', uniqueTranDBRoutingKeys, is_tenantMultiThreaded);
                }

                // Create a worked thread for current key
                function doWithCurrentKey(currentKey) {
                  try {
                    i++;
                    getValue(currentKey, function (currJson, error) {
                      printInfo(serviceName, "currentKey  - " + currentKey, objLogInfo);
                      if (error) {
                        printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0003', 'Error in doWithCurrentKey() - getValue() Callback...', error);
                        if (i < arrTranDBKeys.length) {
                          doWithCurrentKey(arrTranDBKeys[i]);
                        } else {
                          reqLogWriter.EventUpdate(objLogInfo);
                          GetAllUniqueTranDBKeysCB('', uniqueTranDBRoutingKeys, is_tenantMultiThreaded);
                        }
                      } else {
                        var isChildRunning = checkChildRunning(currJson);
                        if (!isChildRunning) {
                          var routingkey = currentKey.replace(connStr + '~', '').toUpperCase();
                          if (uniqueTranDBRoutingKeys.indexOf(routingkey) == -1) {
                            uniqueTranDBRoutingKeys.push(routingkey);
                          }
                          arrRunningChilds.push(currJson);
                          if (i < arrTranDBKeys.length) {
                            doWithCurrentKey(arrTranDBKeys[i]);
                          } else {
                            GetAllUniqueTranDBKeysCB('', uniqueTranDBRoutingKeys, is_tenantMultiThreaded);
                          }
                        } else {
                          printInfo(serviceName, currentKey + ' is already running', objLogInfo);
                          if (i < arrTranDBKeys.length) {
                            doWithCurrentKey(arrTranDBKeys[i]);
                          } else {
                            printInfo(serviceName, 'End', objLogInfo);
                            GetAllUniqueTranDBKeysCB('', uniqueTranDBRoutingKeys, is_tenantMultiThreaded);
                          }
                        }
                      }
                    });
                  } catch (error) {
                    printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0004', 'Catch Error in doWithCurrentKey()...', error);
                    GetAllUniqueTranDBKeysCB(error, uniqueTranDBRoutingKeys, is_tenantMultiThreaded);
                  }
                }

                var arrRunningChilds = [];

                // Check for any child process is running or not
                function checkChildRunning(jsonToStart) {
                  jsonToStart = JSON.parse(jsonToStart);
                  for (var i = 0; i < arrRunningChilds.length; i++) {
                    var runningJson = arrRunningChilds[i];
                    try {
                      runningJson = JSON.parse(runningJson);
                      var server = (jsonToStart && jsonToStart.Server && jsonToStart.Server.trim()) || '';
                      var port = (jsonToStart && jsonToStart.Port && jsonToStart.Port.trim()) || '';
                      var userID = (jsonToStart && jsonToStart.UserID && jsonToStart.UserID.trim()) || '';

                      var runningServer = (runningJson && runningJson.Server && runningJson.Server.trim()) || '';
                      var runningPort = (runningJson && runningJson.Port && runningJson.Port.trim()) || '';
                      var runningUserID = (runningJson && runningJson.UserID && runningJson.UserID.trim()) || '';

                      var currentServerInfo = server + '_' + port + '_' + userID;
                      var runningServerInfo = runningServer + '_' + runningPort + '_' + runningUserID;

                    } catch (error) {
                      printError(serviceName, objLogInfo, 'ERR-PRCT-PRODUCER-1008', 'Catch Error While Comparing currentServerInfo with runningServerInfo', error);
                    }
                    printInfo(serviceName, 'RUNNINGSERVERINFO - ' + runningServerInfo + ' and CURRENTSERVERINFO - ' + currentServerInfo, objLogInfo);
                    if (runningServerInfo == currentServerInfo) {
                      return true;
                    }
                  }
                  return false;
                }
                // }
              } catch (error) {
                printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0005', 'Catch Error in clientRedis.keys() Callback...', error);
                GetAllUniqueTranDBKeysCB(error, uniqueTranDBRoutingKeys, is_tenantMultiThreaded);
              }
            // });
            // });
          }
        } catch (error) {
          printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0006', 'Catch Error in GetRedisConnection() Callback...', error);
          GetAllUniqueTranDBKeysCB(error, uniqueTranDBRoutingKeys, is_tenantMultiThreaded);
        }
      });
    } catch (error) {
      printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0007', 'Catch Error in produceWithAllTranDBKeys()...', error);
      GetAllUniqueTranDBKeysCB(error, uniqueTranDBRoutingKeys, is_tenantMultiThreaded);
    }

  }
  // Grouping the Kafka Consumer Data Based on Routing Key
  // Used While kafka Consumers Consuming
  function GroupByRoutingkey(params, GroupByRoutingkeyCB) {
    try {
      /* params Should Contains
      - objLogInfo
      - HST_DATA
      - FUNCTION
      - THREAD_INFO
   
      */
      var batchFunction = params.FUNCTION;
      var objLogInfo = params.objLogInfo;
      var data = params.HST_DATA;
      var allRountingKeys = []; // Collecting All the Routing Keys
      for (let g = 0; g < data.length; g++) {
        const element = data[g];
        element.value = JSON.parse(element.value.toString()); // To Convert buffer to String while using RdKafka Npm...
        // console.log(element.key, 'key------------', element.partition, 'partition------------', element.offset, '\n=====offset========', element, 'Actual Msg');
        // if (element.value.ROUTING_KEY == 'VPH') { // For development
        if (element.value.ROUTING_KEY) {
          element.value.ROUTING_KEY = element.value.ROUTING_KEY.toUpperCase();
          if (allRountingKeys.indexOf(element.value.ROUTING_KEY) == -1) {
            allRountingKeys.push(element.value.ROUTING_KEY); // Allowed only Not Existed Element (i,e) RoutingKey
          }
        }
      }
      printInfo(serviceName, 'Routing Key List - ' + allRountingKeys.toString(), objLogInfo);
      reqAsync.forEachOfSeries(allRountingKeys, function (routingkey, i, allRountingKeysCB) {
        printInfo(serviceName, 'Current Routing Key - ' + routingkey + ' Process Started', objLogInfo);
        var GetAllIDsInRoutingKeyObj = { ROUTINGKEY: routingkey };
        var routingkeyInfo = GetAllIDsInRoutingKey(GetAllIDsInRoutingKeyObj, objLogInfo);
        printInfo(serviceName, 'Adding Timezone Informations in ObjLogInfo For Tenant ID - ' + routingkeyInfo.TENANT_ID, objLogInfo);
        var GetTenantLevelTimezoneObj = { TENANT_ID: routingkeyInfo.TENANT_ID };
        objLogInfo.TIMEZONE_INFO = GetTenantLevelTimezone(GetTenantLevelTimezoneObj, objLogInfo);
        var routingKeyData = []; // Collecting All the Data Based on Current Routing Key
        for (let g = 0; g < data.length; g++) {
          const element = data[g];
          if (element.value.ROUTING_KEY == routingkey) {
            routingKeyData.push(element);
          }
        }
        var batchFunctionReqObj = {};
        batchFunctionReqObj.hstTableData = routingKeyData;
        batchFunctionReqObj.THREAD_INFO = params.THREAD_INFO;
        batchFunctionReqObj.objLogInfo = objLogInfo;
        batchFunctionReqObj.headers = {
          routingkey: routingkey
        };
        if (!batchFunction) {
          // If there is No Function Provided Within the Params
          printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0009', 'There is No Function Provided Within the Params', '');
          allRountingKeysCB();

        } else {
          // Calling the Provided Function with Grouped Data based on Routingkey
          batchFunction(batchFunctionReqObj, function () {
            // processedMsgCount = processedMsgCount + routingKeyData.length;
            printInfo(serviceName, 'Current Routing Key - ' + routingkey + ' Process Completed', objLogInfo);
            printInfo(serviceName, 'Routing Key List - ' + allRountingKeys.toString(), objLogInfo);
            allRountingKeysCB();
          });
        }
      }, function () {
        printInfo(serviceName, 'All The Routing Keys Data Processed...', objLogInfo);
        GroupByRoutingkeyCB();
      });
    } catch (error) {
      printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0008', 'Catch Error in GroupByRoutingkey()...', error);
      GroupByRoutingkeyCB();
    }

  }



  // In service Startup, Set The Timezone Informations For All the Tenants in tenantLevelTimezoneSession
  // Used in kafka Producers and Consumers
  function GetTenantTimezoneInfo(params, GetTenantTimezoneInfoCB) {
    try {
      /* params Should Contains
      - objLogInfo
      */

      var objLogInfo = params.objLogInfo;
      var reqDBInstance = require('../instance/DBInstance');
      var reqsvchelper = require('../common/serviceHelper/ServiceHelper');
      var GetAllUniqueFxDBKeysObj = { objLogInfo };
      GetAllUniqueFxDBKeys(GetAllUniqueFxDBKeysObj, function (error, arrGetAllUniqueFxDBKeys) {
        if (error) {
          printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0020', 'Error While Getting Unique Fx DB Keys', error);
          GetTenantTimezoneInfoCB();
        } else if (!arrGetAllUniqueFxDBKeys.length) {
          printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0021', 'Error While Getting Unique Fx DB Keys', '');
          GetTenantTimezoneInfoCB();
        }
        else {
          var tenantLevelTimezoneInfo = {};
          printInfo(serviceName, 'Fx DB Routing Keys - ' + arrGetAllUniqueFxDBKeys.toString(), objLogInfo);
          printInfo(serviceName, 'FX DB Tenant Count | ' + arrGetAllUniqueFxDBKeys.length, objLogInfo);
          reqAsync.forEachOfSeries(arrGetAllUniqueFxDBKeys, function (FxDBRoutingKey, i, nextFxDBRoutingKey) {
            printInfo(serviceName, 'Current Routing Key - ' + FxDBRoutingKey, objLogInfo);
            var GetAllIDsInRoutingKeyObj = { ROUTINGKEY: FxDBRoutingKey };
            var routingKeyInfo = GetAllIDsInRoutingKey(GetAllIDsInRoutingKeyObj, objLogInfo);
            var TENANT_ID = routingKeyInfo.TENANT_ID;
            printInfo(serviceName, 'Current TENANT ID - ' + TENANT_ID, objLogInfo);
            var headers = { routingkey: FxDBRoutingKey };
            reqDBInstance.GetFXDBConnection(headers, 'clt_cas', objLogInfo, function (clt_cas_instance) {
              var tableName = 'TENANT_SETUP';
              var pCond = { category: 'TIMEZONE' };
              reqDBInstance.GetTableFromFXDB(clt_cas_instance, tableName, [], pCond, objLogInfo, function (error, result) {
                if (error) {
                  printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0029', 'Error While Getting TIMEZONE_INFO From TENANT_SETUP Table', error);
                  nextFxDBRoutingKey();
                } else {
                  if (result && result.rows && result.rows.length) {
                    var data = result.rows;
                    for (let x = 0; x < data.length; x++) {
                      const element = data[x];
                      tenantLevelTimezoneInfo[element.tenant_id.toUpperCase()] = JSON.parse(element.setup_json);
                    }
                    // Storing the Tenant Level Informations as Global
                    tenantLevelTimezoneSession = tenantLevelTimezoneInfo;
                    printInfo(serviceName, 'Tenant Level TIMEZONE_INFO - ' + JSON.stringify(tenantLevelTimezoneSession, '', '\t'), objLogInfo);
                    nextFxDBRoutingKey();
                  } else {
                    printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0030', 'There Is No TIMEZONE_INFO From TENANT_SETUP Table With ROUTINGKEY - ' + FxDBRoutingKey, '');
                    nextFxDBRoutingKey();
                  }
                }
              });
            });

          }, function () {
            reqsvchelper = '';
            destroyConn(serviceName, objLogInfo, function () {
              printInfo(serviceName, 'Connection destroyed ', objLogInfo)
            })
            GetTenantTimezoneInfoCB(true);
          });
        }
      });

    } catch (error) {
      printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0008', 'Catch Error in GroupByRoutingkey()...', error);
      GetTenantTimezoneInfoCB();
    }

  }

  function GetTenantLevelTimezone(params, pLogInfo) {
    try {
      /* params Should Contains
      - TENANT_ID */

      printInfo(serviceName, 'Getting Tenant Level Timezone Informations', objLogInfo);
      var tenantID = (params && params.TENANT_ID) || '';
      if (tenantID) {
        printInfo(serviceName, 'TENANT_ID | ' + tenantID, objLogInfo);
        var timezoneInfo = tenantLevelTimezoneSession[tenantID.toUpperCase()];
        printInfo(serviceName, 'Timezone Info For TENANT_ID -  ' + tenantID + ' | ' + JSON.stringify(timezoneInfo), objLogInfo);
        return timezoneInfo;
      } else {
        printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0025', 'TENANT_ID is Not Available. Hence Applying All the Tenant Informations', '');
        return tenantLevelTimezoneSession;
      }

    } catch (error) {
      printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0024', 'Catch Error in GetTenantLevelTimezone()...', error);
      return tenantLevelTimezoneSession;
    }

  }

  function GetAllIDsInRoutingKey(params, objLogInfo) {
    try {
      /* params Should Contains
      - ROUTINGKEY */
      var routingKeyInfo = {};
      var routingkey = (params && params.ROUTINGKEY) || '';
      if (routingkey) {
        var splitResult = routingkey.split('~');
        var APP_ID;
        var CLIENT_ID;
        var TENANT_ID;
        if (splitResult.length > 2) {
          CLIENT_ID = splitResult[0].replace('CLT-', '');
          APP_ID = splitResult[1].replace('APP-', '');
          TENANT_ID = splitResult[2].replace('TNT-', '');
          routingKeyInfo.APP_ID = APP_ID;
          routingKeyInfo.CLIENT_ID = CLIENT_ID;
          routingKeyInfo.TENANT_ID = TENANT_ID;
        }
        printInfo(serviceName, 'TENANT_ID | ' + TENANT_ID, objLogInfo);
        printInfo(serviceName, 'APP_ID | ' + APP_ID, objLogInfo);
        printInfo(serviceName, 'CLIENT_ID | ' + CLIENT_ID, objLogInfo);
      } else {
        printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0023', 'There is No Rountingkey Provided Within the Params', '');
      }
      return routingKeyInfo;

    } catch (error) {
      printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0022', 'Catch Error in GetAllIDsInRoutingKey()...', error);
      return routingKeyInfo;
    }
  }

  function GetServiceParamsSession(params) {
    try {
      /* Input Params are
     - SERVICE_NAME
     - objLogInfo  
     */
      var serviceParamResult = {};
      if (!params) {
        params = {};
      }
      var objLogInfo = params.objLogInfo;
      var SERVICE_NAME = params.SERVICE_NAME;
      if (SERVICE_NAME) {
        serviceParamResult = ServiceParamsSession[SERVICE_NAME];
      } else {
        serviceParamResult = ServiceParamsSession;
      }
    } catch (error) {
      printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0028', 'Catch Error in GetServiceParamsSession()...', error);
      printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0028', 'Catch Error in GetServiceParamsSession()...', error);
    }
    finally {
      return serviceParamResult;
    }
  }
  // Used Only in BG Process
  // Assigning Audit Columns into objLogInfo
  function PrepareAuditColumnsInBGProcess(objLogInfo, alteredData) {
    try {
      var alteredData = ArrKeyToLowerCase([alteredData])[0];
      if (alteredData.routingkey) {
        var routingkey = alteredData.routingkey;
        var headers = { routingkey };
        objLogInfo.headers = headers;
      }

      if (alteredData.app_id) {
        objLogInfo.APP_ID = alteredData.app_id;
      }
      if (alteredData.tenant_id) {
        objLogInfo.TENANT_ID = alteredData.tenant_id;
      }

      if (alteredData.created_by_name) {
        objLogInfo.LOGIN_NAME = alteredData.created_by_name;
      }
      if (alteredData.created_clientip) {
        objLogInfo.CLIENTIP = alteredData.created_clientip;
      }
      if (alteredData.created_by) {
        objLogInfo.USER_ID = alteredData.created_by;
      }
      if (alteredData.created_tz) {
        objLogInfo.CLIENTTZ = alteredData.created_tz;
      }
      if (alteredData.created_tz_offset) {
        objLogInfo.CLIENTTZ_OFFSET = alteredData.created_tz_offset;
      }
      if (alteredData.created_by_sessionid) {
        objLogInfo.SESSION_ID = alteredData.created_by_sessionid;
      }

      if (alteredData.modified_by_name) {
        objLogInfo.LOGIN_NAME = alteredData.modified_by_name;
      }
      if (alteredData.modified_clientip) {
        objLogInfo.CLIENTIP = alteredData.modified_clientip;
      }
      if (alteredData.modified_by) {
        objLogInfo.USER_ID = alteredData.modified_by;
      }
      if (alteredData.modified_tz) {
        objLogInfo.CLIENTTZ = alteredData.modified_tz;
      }
      if (alteredData.modified_tz_offset) {
        objLogInfo.CLIENTTZ_OFFSET = alteredData.modified_tz_offset;
      }
      if (alteredData.modified_by_sessionid) {
        objLogInfo.SESSION_ID = alteredData.modified_by_sessionid;
      }

    } catch (error) {
      printError(serviceName, objLogInfo, 'ERR_INSTANCE_HELPER_0031', 'Catch Error in PrepareAuditColumns()...', error);
    }
  }


  module.exports = {
    IsRedisKeyAvail: isRedisKeyAvail,
    GetRedisKey: getRedisKey,
    GetAllRedisKeys: getAllRedisKeys,
    PrintError: printError,
    PrintInfo: printInfo,
    PrintWarn: printWarn,
    GetConfig: getValue,
    Guid: guid,
    ArrKeyToUpperCase: arrKeyToUpperCase,
    ArrKeyToLowerCase: ArrKeyToLowerCase,
    SendResponse: sendResponse,
    EmitSocketMessage: EmitSocketMessage,
    ReadConfigFile: readConfigFile,
    GetRedisValue: getRedisValue,
    getservicemodel: getservicemodel,
    restartSvc: restartSvc,
    WriteServiceLog: writeServiceLog,
    GetServiceFileName: GetServiceFileName,
    RenameServiceLogFile: RenameServiceLogFile,
    CheckServiceLogFiles: CheckServiceLogFiles,
    ReadingServiceLogFile: ReadingServiceLogFile,
    GetServiceInfo: GetServiceInfo,
    DynamicFolderCreation: DynamicFolderCreation,
    DynamicFolderCreationwithCallback: DynamicFolderCreationwithCallback,
    DestroyConn: destroyConn,
    GetRedisServiceParamConfig: GetRedisServiceParamConfig,
    DoRedisSetnx: DoRedisSetnx,
    CheckIdleTimeAndRestart: CheckIdleTimeAndRestart,
    ReplaceSpecialCharacter: ReplaceSpecialCharacter,
    CheckMemoryAndIdleTime: CheckMemoryAndIdleTime,
    GetAllUniqueFxDBKeys: GetAllUniqueFxDBKeys,
    GetAllUniqueTranDBKeys: GetAllUniqueTranDBKeys,
    GroupByRoutingkey: GroupByRoutingkey,
    GetTenantTimezoneInfo: GetTenantTimezoneInfo,
    GetTenantLevelTimezone: GetTenantLevelTimezone,
    GetAllIDsInRoutingKey: GetAllIDsInRoutingKey,
    GetServiceParamsSession: GetServiceParamsSession,
    PrepareAuditColumnsInBGProcess: PrepareAuditColumnsInBGProcess
  };
  /********* End of File *************/

} catch (error) {
  console.log(error, 'Catch Error in InstanceHelper File');
}