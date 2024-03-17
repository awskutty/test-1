/****
  @Descriptions     :  To consume PRC_TOKENS_CORE topic to prepare auditing data in solr  
  @Last_Error_Code  :  ERR-LOG-CONSUMER-0010
 ****/

// Require dependencies
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqkafkaInstance = require('../../../../../torus-references/instance/KafkaInstance');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var logFilePath = 'bgprocess/consumer/logconsumer';
var reqSolrHelper = require('../../../../../torus-references/log/trace/SolrLogHelper')
var objLogInfo = reqLogWriter.GetLogInfo('LOGCONSUMER', 'LOGCONSUMER_PROCESS', 'LOGCONSUMER_PROCESS_ACTION', logFilePath);
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter')
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance')

var reqAsync = require('async');
var cron = require('node-cron');


// Starting consumer for topic TRAN_DATA
function startConsuming(pConsumerName, pTopic, pConsumer, pKafka) {
    try {
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        var prctokenCore = "PRC_TOKENS_CORE";
        if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
            prctokenCore = "PRC_TOKEN";
        }
        reqInstanceHelper.PrintInfo(pConsumerName, 'Started consuming', objLogInfo);
        reqLogWriter.EventUpdate(objLogInfo);
        var maxKafkaMsgCount = pKafka.maxKafkaMsgCount;
        ConsumeDataFromKafka().catch();
        var LogInProgress = false;
        var processedMsgCount = 0;
        var maxProcessingMsgCount = 10000;
        var pHeader = { routingkey: 'CLT-0~APP-0~TNT-0~ENV-0' }
        var isPaused = false
        async function ConsumeDataFromKafka(params) {
            try {
                LogInProgress = true;
                reqInstanceHelper.PrintInfo(pConsumerName, 'Consuming Data From Kafka...', objLogInfo);

                var logdata = [];
                await pConsumer.run({
                    eachMessage: async ({ topic, partition, message }) => {
                        logdata.push(message.value.toString());
                        if (!isPaused) {
                            isPaused = true;
                            setTimeout(async () => {
                                await pConsumer.pause([{ "topic": "topic" }])
                                reqInstanceHelper.PrintInfo(pConsumerName, 'Consumer paused', objLogInfo);
                                LogInsertProcess(logdata, pConsumer);
                                logdata = []
                            }, 500)
                        }
                    }
                })
            } catch (error) {
                reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-ATMT-CONSUMER-0004', 'Catch Error in ConsumeDataFromKafka()...', error);
                LogInProgress = false;
            }
        }

        // To Verify and Restart the Service Based on the processed msg Count and Maximum Processing Msg Count
        // Temporary Code For Memory Leak
        function CheckProcessedMsgCountAndRestart(params, CheckProcessedMsgCountAndRestartCB) {
            try {
                if (processedMsgCount > maxProcessingMsgCount) {
                    reqInstanceHelper.PrintInfo(pConsumerName, 'Going to Restart the Service...', objLogInfo);
                    reqInstanceHelper.restartSvc(objLogInfo);
                } else {
                    CheckProcessedMsgCountAndRestartCB(null, true);
                }
            } catch (error) {
                CheckProcessedMsgCountAndRestartCB(error, null);
            }
        }
        function LogInsertProcess(pdata, consumer) {
            try {
                var startTime = '';
                var endTime = '';
                var hstDeleteTopicName = '';
                startTime = new Date().toLocaleString();
                reqInstanceHelper.PrintInfo(pConsumerName, 'Total Message Count - ' + pdata.length, objLogInfo);
                var insertrows = []
                reqAsync.forEachOfSeries(pdata, function (message, i, CB) {
                    try {
                        var insertobj = {}
                        //message.value = JSON.parse(message).MESSAGE; // To Convert buffer to String while using RdKafka Npm...
                        var pData = JSON.parse(message);
                        console.log("log Insert into db started");
                        var b = new Buffer.from(pData.MESSAGE, 'base64');
                        pData.MESSAGE = b.toString();
                        insertobj = {
                            ACTION: pData.ACTION_DESC ? pData.ACTION_DESC : '',
                            HOST_NAME: pData.HOST_NAME,
                            ISERROR: pData.ISERROR,
                            IS_EVENT: pData.IS_EVENT,
                            IS_INFO: pData.IS_INFO,
                            TENANT_ID: pData.TENANT_ID,
                            ERROR_CODE: pData.ERROR_CODE ? pData.ERROR_CODE : '',
                            LOGTYPE: pData.LOGTYPE ? pData.LOGTYPE : '',
                            MESSAGE: pData.MESSAGE ? pData.MESSAGE : '',
                            PRCT_ID: pData.PRCT_ID ? pData.PRCT_ID : '',
                            PROCESS: pData.PROCESS ? pData.PROCESS : '',
                            SERVICEURL: pData.SERVICEURL ? pData.SERVICEURL : '',
                            SERVICE_NAME: pData.SERVICE_NAME ? pData.SERVICE_NAME : '',
                            PROCESS_INFO: JSON.stringify(pData.PROCESS_INFO),
                            APP_DESC: pData.APP_DESC ? pData.APP_DESC : '',
                            APP_ID: pData.APP_ID ? pData.APP_ID : '',
                            CLIENTURL: pData.CLIENTURL ? pData.CLIENTURL : '',
                            HANDLER_CODE: pData.HANDLER_CODE ? pData.HANDLER_CODE : '',
                            SESSION_ID: pData.SESSION_ID ? pData.SESSION_ID : '',
                            STARTTIME: reqDateFormatter.GetDateTimeWithTenantTZ(pData.headers, {}, pData.STARTTIME),
                            SYSTEM_DESC: pData.SYSTEM_DESC ? pData.SYSTEM_DESC : '',
                            SYSTEM_ID: pData.SYSTEM_ID ? pData.SYSTEM_ID : '',
                            USER_ID: pData.USER_ID ? pData.USER_ID : '',
                            LOGIN_NAME: pData.USER_NAME ? pData.USER_NAME : '',
                            ENDTIME: reqDateFormatter.GetDateTimeWithTenantTZ(pData.headers, {}, pData.ENDTIME)
                        }
                        insertrows.push(insertobj);
                        CB();
                    } catch (error) {
                        CB();
                    }
                }, function () {
                    try {
                        reqDBInstance.GetFXDBConnection(pHeader, 'log_cas', objLogInfo, function (logDbConn) {
                            try {
                                reqTranDBInstance.InsertBulkTranDB(logDbConn, 'TRACE_LOG', insertrows, objLogInfo, 200, function (pResult, pError) {
                                    try {
                                        if (pError) {
                                            reqInstanceHelper.PrintInfo(pConsumerName, 'Error occured while insert the data into table. The error is | ' + pError, objLogInfo);
                                        }
                                        pdata = [];
                                        insertrows = []
                                        reqInstanceHelper.DestroyConn(pConsumerName, objLogInfo, function () {
                                            //consumer.resume([{ "topic": batch.topic }]) 
                                            isPaused = false
                                            pConsumer.resume([{ "topic": 'TRACE_LOG' }]);
                                            reqInstanceHelper.PrintInfo(pConsumerName, 'Consumer resume', objLogInfo);
                                        })
                                    } catch (error) {
                                        LogInProgress = false;
                                        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-LOG-CONSUMER-0017', 'Exception occured while insert the logs into db', error);
                                    }
                                })
                            } catch (error) {
                                LogInProgress = false;
                                reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-LOG-CONSUMER-0016', 'Exception occured while insert the logs into db', error);
                            }
                        })
                    } catch (error) {
                        LogInProgress = false;
                        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-LOG-CONSUMER-0015', 'Exception occured while insert the logs into db', error);
                    }
                });
            } catch (error) {
                LogInProgress = false;
                reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-LOG-CONSUMER-0005', 'Catch Error in PrctLogProcess()', error);
            }
        }
    } catch (error) {
        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-LOG-CONSUMER-0009', 'Catch Error in startConsuming()...', error);
    }
}

module.exports = {
    StartConsuming: startConsuming
};
/******** End of File **********/