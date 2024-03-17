/****
  Descriptions - To consume TRAN_DATA topic to prepare auditing data in solr  
  @Last_Error_Code              : ERR-FXTRAN-CONSUMER-0004
 ****/

// Require dependencies
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqkafkaInstance = require('../../../../../torus-references/instance/KafkaInstance');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var reqRecoveryLog = require('../../../../../torus-references/log/recovery/RecoveryLog');
var reqProducer = require('../../../../../torus-references/common/Producer');
var logFilePath = 'bgprocess/consumer/fxtranconsumer';
var objLogInfo = GetObjLogInfo();
var reqThreadHelper = require('./ThreadHelper');
var serviceName = 'FxTranConsumer';
var reqAsync = require('async');
var cron = require('node-cron');
var reqPath = require('path');

var globalServiceLogDataProblemFolderPath = reqPath.join(__dirname, '../service_logs/data_problem/');
// Collecting All the Consumer Thread Informations while Startup
var consumerAllThreadInfo = [];

// Starting consumer for topic TRAN_DATA
function startConsuming(pConsumerName, pTopic, pConsumer, pKafka) {
    try {
        reqInstanceHelper.PrintInfo(pConsumerName, 'Started consuming', objLogInfo);
        reqLogWriter.EventUpdate(objLogInfo);

        var failureTopicName = 'HST_FX_TABLE_DATA_FXTRANCONSUMER_FAILURES';
        var serviceLogDataProblemFolderPath = reqPath.join(__dirname, '../service_logs/data_problem/');
        // Getting Service Params from Redis
        var maxMemorySize = 300; // In MB
        var restartFlag = false;
        var maxIdleTime = 600; // In Seconds [By Default 15Minutes]
        // var maxIdleTime = 30; // @@@
        // eachMsgStartTime = new Date();// @@@
        var serviceParams = pKafka.SERVICE_PARAMS && JSON.parse(JSON.stringify(pKafka.SERVICE_PARAMS)) || {};
        if (serviceParams.FORCED_ACTIVE_THREAD_TIMEOUT_SEC) {
            maxIdleTime = serviceParams.FORCED_ACTIVE_THREAD_TIMEOUT_SEC; // Assigning the Idle Time from the Redis Service Params 
        }
        if (serviceParams.RESTART_MEMORY_VALUE_MB) {
            maxMemorySize = serviceParams.RESTART_MEMORY_VALUE_MB; // Assigning the Memory Size from the Redis Service Params 
        }
        if (serviceParams.RESTART_FLAG) {
            // Assigning the RESTART_FLAG from the Redis Service Params 
            restartFlag = serviceParams.RESTART_FLAG;
        }
        var strMsg = '';
        var headers = {
            routingkey: 'TRANDB~CLT-0~APP-0~TNT-0~ENV-0'
        };
        var jsonToSend = {
            AppId: '0',
            Header: headers,
            LogInfo: objLogInfo
        };
        var hstDeleteTopicName = 'DELETE_HST_FX_TABLE_DATA';
        var maxKafkaMsgCount = pKafka.maxKafkaMsgCount;
        var deleteHstSchema = {
            "schema": {
                "type": "struct",
                "fields": [
                    {
                        "type": "int32"
                    }
                ]
            },
            "payload": {}
        };
        if (maxKafkaMsgCount) {
            if (serviceParams && serviceParams.PROCESS_MSG_COUNT) {
                maxKafkaMsgCount = serviceParams.PROCESS_MSG_COUNT;
            }
            ConsumeDataFromKafka();
        }
        var processedMsgCount = 0;

        if (consumerAllThreadInfo.indexOf(pTopic) == -1) {
            var consumerThread = {
                topic: pTopic,
                isDone: true,
                objLogInfo: GetObjLogInfo(),
                overAllStartTime: '',
                overAllEndTime: '',
                eachMsgStartTime: '',
                KafkaInstance: pKafka,
                Consumer: pConsumer,
                threadProcessingInfo: '',
                allTimezoneInfo: reqInstanceHelper.GetTenantLevelTimezone({}, objLogInfo)
            }
            consumerAllThreadInfo.push(consumerThread);
        }

        function ConsumeDataFromKafka(params) {
            try {
                cron.schedule('*/10 * * * * *', function () {

                    var currentTopic = pTopic;
                    var currentThreadIndex = consumerAllThreadInfo.findIndex(obj => obj.topic == currentTopic);
                    var currentThreadInfo = consumerAllThreadInfo[currentThreadIndex];
                    var objLogInfo = currentThreadInfo.objLogInfo; // Assiging unique Loginfo for Each Topic
                    // return;
                    if (currentThreadInfo.isDone) {
                        currentThreadInfo.eachMsgStartTime = new Date().toLocaleString();
                        var CheckMemoryAndIdleTimeReqObj = {
                            objLogInfo: objLogInfo,
                            CONSUMER_ALLTHREAD_INFO: consumerAllThreadInfo,
                            MSG_PROCESSED_COUNT: processedMsgCount,
                            RESTART_FLAG: restartFlag,
                            CURRENT_TOPIC: currentTopic,
                            MAX_MEMORY_SIZE: maxMemorySize
                        };
                        reqInstanceHelper.CheckMemoryAndIdleTime(CheckMemoryAndIdleTimeReqObj, function () {
                            currentThreadInfo.isDone = false; // Process Started
                            reqInstanceHelper.PrintInfo(serviceName, '---------- Consuming Data From Kafka Topic', objLogInfo);
                            console.log(currentThreadInfo.Consumer.name, currentThreadInfo.KafkaInstance.Consumer.name)
                            pConsumer.consume(maxKafkaMsgCount, function (error, data) {
                                if (error) {
                                    reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-ATMT-CONSUMER-0003', '---------- Error While Consuming Data from Kafka - ' + currentTopic + ' ----------', error);
                                    currentThreadInfo.isDone = true; // Process Completed
                                } else {
                                    if (data && data.length) {
                                        // return pConsumer.commit();
                                        objLogInfo.TIMEZONE_INFO = ''; // Making as Empty to clear the Cache
                                        var GroupByRoutingkeyReqObj = {};
                                        GroupByRoutingkeyReqObj.objLogInfo = objLogInfo;
                                        GroupByRoutingkeyReqObj.HST_DATA = data;
                                        GroupByRoutingkeyReqObj.THREAD_INFO = currentThreadInfo;
                                        GroupByRoutingkeyReqObj.FUNCTION = StartFxTranLogProcess;
                                        reqInstanceHelper.GroupByRoutingkey(GroupByRoutingkeyReqObj, function () {
                                            currentThreadInfo.threadProcessingInfo = 'Committing Kafka Messages';
                                            reqkafkaInstance.DoCommit(pKafka, function () {
                                                currentThreadInfo.threadProcessingInfo = 'Committed Kafka Messages';
                                                reqInstanceHelper.PrintInfo(serviceName, 'Message Committed Successfully For ' + currentThreadInfo.topic, objLogInfo);
                                                currentThreadInfo.isDone = true; // Process Completed
                                            });
                                        });
                                    } else {
                                        reqInstanceHelper.PrintInfo(serviceName, '---------- There is No Data From Kafka', objLogInfo);
                                        reqLogWriter.EventUpdate(objLogInfo);
                                        currentThreadInfo.isDone = true; // @@@
                                    }
                                }
                            });
                        });
                    } else {
                        reqInstanceHelper.PrintInfo(serviceName, 'Still Process is Going on For | ' + consumerThread.threadProcessingInfo, objLogInfo);
                        var CheckMemoryAndIdleTimeReqObj = {
                            objLogInfo: objLogInfo,
                            MSG_PROCESSED_COUNT: processedMsgCount,
                            RESTART_FLAG: restartFlag,
                            CURRENT_TOPIC: currentTopic,
                            MAX_MEMORY_SIZE: maxMemorySize,
                            CURRENT_THREAD_INFO: currentThreadInfo,
                            MAX_IDLE_TIME: maxIdleTime,
                            PROCESS_START_TIME: currentThreadInfo.eachMsgStartTime
                            , NEED_RESTART: true
                        };
                        reqInstanceHelper.CheckMemoryAndIdleTime(CheckMemoryAndIdleTimeReqObj, function () {
                            reqLogWriter.EventUpdate(objLogInfo);
                        });
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-ATMT-CONSUMER-0004', 'Catch Error in ConsumeDataFromKafka()...', error);
            }
        }


        function StartFxTranLogProcess(params, StartFxTranLogProcessCB) {
            try {
                var objLogInfo = params.objLogInfo;
                var arrTrnIDs = [];
                // Looping Through all the TRANS to print the TRN IDS
                for (let c = 0; c < params.hstTableData.length; c++) {
                    const element = params.hstTableData[c];
                    var strMsg = element.value.HST_DATA;
                    strMsg = reqInstanceHelper.ArrKeyToLowerCase([strMsg])[0];
                    arrTrnIDs.push(strMsg.core_unique_id); // core_unique_id = table_name - tran_id
                }
                // Processing Trn IDs - EX_HEADER_FILES - 132559 , EX_HEADER_FILES - 132558 , EX_HEADER_FILES - 132557
                reqInstanceHelper.PrintInfo(serviceName, 'Processing Trn IDs - ' + arrTrnIDs.toString().replace(/,/g, ' , '), objLogInfo);
                arrTrnIDs = [];
                // return; // For Development
                var processedIDs = [];
                var unProcessedIDs = [];
                var threadInfo = params.THREAD_INFO;
                threadInfo.eachMsgStartTime = new Date().toLocaleString();
                var headers = params.headers;  
                var serviceLogDataProblemFolderPath;

                threadInfo.overAllStartTime = new Date().toLocaleString();
                reqInstanceHelper.PrintInfo(serviceName, 'Total Message Count - ' + params.hstTableData.length, objLogInfo);
                // Getting Tran DB Connections
                headers.LOG_INFO = objLogInfo;
                threadInfo.threadProcessingInfo = 'Getting TRAN DB Connection';
                reqTranDBInstance.GetTranDBConn(headers, false, function (tran_db_instance) {
                    threadInfo.threadProcessingInfo = 'Getting TRAN DB Connection Process Completed';
                    if (headers.LOG_INFO) delete headers.LOG_INFO;
                    reqAsync.forEachOfSeries(params.hstTableData, function (message, i, CB) {
                        try {
                            serviceLogDataProblemFolderPath = globalServiceLogDataProblemFolderPath;
                            var failureData = {};
                            failureData.FAILURE_TOPIC_NAME = failureTopicName;
                            failureData.SERVICE_LOG_PATH = serviceLogDataProblemFolderPath;
                            failureData.TRAN_DB_INSTANCE = tran_db_instance;
                            failureData.TABLE_NAME = 'HST_FX_TABLE_DATA';
                            failureData.TOPIC_OFFSET = message.offset;
                            failureData.TOPIC_PARTITION = message.partition;
                            threadInfo.eachMsgStartTime = new Date();
                            var strMsg = message.value.HST_DATA;
                            // console.log(message.key, 'key------------', message.partition, 'partition------------', message.offset, '\n=====offset========', message, 'Actual Msg');
                            if (strMsg) {
                                strMsg = reqInstanceHelper.ArrKeyToLowerCase([strMsg])[0];
                                var AppID = strMsg.app_id;
                                var TenantID = strMsg.tenant_id;
                                var routingkey = strMsg.routingkey;
                                if (AppID && TenantID) {
                                    serviceLogDataProblemFolderPath = serviceLogDataProblemFolderPath + TenantID + '\\' + AppID + '\\'; // Adding APP ID and Tenant ID 
                                }
                                failureData.SERVICE_LOG_PATH = serviceLogDataProblemFolderPath;
                                reqInstanceHelper.PrepareAuditColumnsInBGProcess(objLogInfo, strMsg);
                                failureData.HST_DATA = JSON.parse(JSON.stringify(strMsg));
                                var tranCoreObj = {};
                                tranCoreObj.objLogInfo = objLogInfo;
                                tranCoreObj.topic_name = 'FX_TRAN';
                                tranCoreObj.hst_fx_json = strMsg;
                                tranCoreObj.headers = headers;
                                // tranCoreObj.dep_cas_instance = msgFromWorker.dep_cas_instance;
                                reqThreadHelper.PrepareProduceTranNfxCoreData(tranCoreObj, function (tranCoreInfo) {

                                    if (tranCoreInfo.status == 'SUCCESS') {
                                        // Collecting All the Succcessfully Processed IDs
                                        processedIDs.push(strMsg.hftd_id);
                                        threadInfo.eachMsgStartTime = '';
                                        CB();

                                        /* This code is for deleting the hst table data via DB sink connector by using kafka topic
                                         if (message.topic == 'PRF.hst_fx_table_data') {
                                             deleteHstSchema.payload.hftd_id = strMsg.hftd_id;
                                             deleteHstSchema.schema.fields[0].field = 'hftd_id';
                                         } else {
                                             deleteHstSchema.payload.HFTD_ID = strMsg.hftd_id;
                                             deleteHstSchema.schema.fields[0].field = 'HFTD_ID';
                                         }
                                        
                                         // Deleting Hst table Data only for the positive flow and it will be helpful for verify the data for negative cases
                                         reqProducer.ProduceMessage(hstDeleteTopicName, null, null, function (res) {
                                             strMsg = {};
                                             tranCoreObj = {};
                                             CB();
                                         }, deleteHstSchema); */

                                    } else {
                                        // Collecting All the UnunProcessedIDsProcessed IDs
                                        unProcessedIDs.push(strMsg.hftd_id);
                                        threadInfo.eachMsgStartTime = '';
                                        var errorMsg = 'Error While Preparing and Producing Data into a Kafka Topic';
                                        var errorCode = 'ERR-FXTRAN-CONSUMER-0003';
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, errorCode, errorMsg);
                                        var errorObj = tranCoreInfo.errorObj || {};
                                        failureData.objLogInfo = objLogInfo;
                                        failureData.ERROR_OBJ = errorObj.stack || errorObj;
                                        failureData.ERROR_CODE = errorCode;
                                        failureData.ERROR_MSG = tranCoreInfo.errorInfo;
                                        reqRecoveryLog.HandleConsumerFailures(failureData, CB);
                                    }
                                });
                            } else {
                                threadInfo.eachMsgStartTime = '';
                                var errorMsg = 'Message not valid';
                                var errorCode = 'ERR-FXTRAN-CONSUMER-0001';
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, errorCode, errorMsg);
                                failureData.objLogInfo = objLogInfo;
                                failureData.ERROR_CODE = errorCode;
                                failureData.ERROR_MSG = errorMsg;
                                reqRecoveryLog.HandleConsumerFailures(failureData, CB);
                            }
                        } catch (error) {
                            threadInfo.eachMsgStartTime = '';
                            var errorMsg = 'Catch Error in forEachOfSeries() and HST_DATA is not Available';
                            var errorCode = 'ERR-FXTRAN-CONSUMER-0004';
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, errorCode, errorMsg);

                            failureData.objLogInfo = objLogInfo;
                            failureData.ERROR_OBJ = error.stack;
                            failureData.ERROR_CODE = errorCode;
                            failureData.ERROR_MSG = errorMsg;
                            reqRecoveryLog.HandleConsumerFailures(failureData, CB);
                        }
                    },
                        function () {
                            reqInstanceHelper.PrintInfo(serviceName, 'Total Processed Message Count - ' + params.hstTableData.length, objLogInfo);
                            reqInstanceHelper.PrintInfo(serviceName, 'Processed Message IDs - ' + processedIDs.toString(), objLogInfo);
                            reqInstanceHelper.PrintInfo(serviceName, 'UnProcessed Message IDs - ' + unProcessedIDs.toString(), objLogInfo);
                            reqInstanceHelper.PrintInfo(serviceName, 'Message Committed Successfully...', objLogInfo);
                            // Closing The Connection 
                            threadInfo.threadProcessingInfo = 'Closing the DB Connections';
                            reqInstanceHelper.DestroyConn(pConsumerName, objLogInfo, function () {
                                threadInfo.threadProcessingInfo = 'Closed the DB Connections';
                                threadInfo.overAllEndTime = new Date().toLocaleString();
                                reqInstanceHelper.PrintInfo(serviceName, 'Process Start Time - ' + threadInfo.overAllStartTime, objLogInfo);
                                reqInstanceHelper.PrintInfo(serviceName, 'Process End Time - ' + threadInfo.overAllEndTime, objLogInfo);
                                params = {};
                                threadInfo.overAllStartTime = '';
                                threadInfo.overAllEndTime = '';
                                threadInfo.eachMsgStartTime = '';// Resetting here For the Previously Processed Msg
                                reqLogWriter.EventUpdate(objLogInfo);
                                StartFxTranLogProcessCB();
                            });
                        });
                });
            } catch (error) {
                reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-FXTRAN-CONSUMER-0005', 'Catch Error in StartFxTranLogProcess()', error);
                StartFxTranLogProcessCB();
            }
        }

    } catch (error) {
        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-FXTRAN-CONSUMER-0002', 'Catch Error in startConsuming()...', error);
    }
}

function GetObjLogInfo() {
    try {
        return reqLogWriter.GetLogInfo('FX_TRAN_CONSUMER', 'FX_TRAN_CONSUMER_PROCESS', 'FX_TRAN_CONSUMER_ACTION', logFilePath);
    } catch (error) {
        return {};
    }
}

module.exports = {
    StartConsuming: startConsuming
};
/******** End of File **********/