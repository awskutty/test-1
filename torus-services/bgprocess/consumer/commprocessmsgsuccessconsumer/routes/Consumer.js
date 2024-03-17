/****
  Descriptions - To consume COMM_PROCESS_MESSAGE_SUCCESS_ topic to Update COMM_PROCESS_MESSAGE Table
  @Last_Error_Code              : ERR_COMM_PROCESS_MSG_SUCCESS_CONSUMER_00002
 ****/

// Require dependencies
var reqAsync = require('async');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var reqkafkaInstance = require('../../../../../torus-references/instance/KafkaInstance');
var logFilePath = 'bgprocess/consumer/commprocessmsgsuccessconsumer';
var serviceName = 'commprocessmsgsuccessconsumer';
var reqTranDBHelper = require('../../../../../torus-references/instance/TranDBInstance');

// Starting consumer for topic COMM_PROCESS_MESSAGE
async function startConsuming(pConsumerName, pTopic, pConsumer, pKafka) {
    try {
        var initialLogInfo = {};
        reqInstanceHelper.PrintInfo(pConsumerName, 'Started Consumer For ' + pTopic, initialLogInfo);
        reqLogWriter.EventUpdate(initialLogInfo);

        var optionalParams = pKafka.OPTIONAL_PARAMS;
        var isTenantMultiThreaded = optionalParams.IS_TENANT_MULTI_THREADED;

        await pConsumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    var objLogInfo = GetObjLogInfo(); // This Is To Get Unique Connection ID Which Helps To Filter The Log
                    objLogInfo.IS_TENANT_MULTI_THREADED = isTenantMultiThreaded; // Storing  Tenant Multi Threaded Control

                    var headers = {
                        LOG_INFO: objLogInfo
                    };
                    reqInstanceHelper.PrintInfo(serviceName, 'IS_TENANT_MULTI_THREADED - ' + objLogInfo.IS_TENANT_MULTI_THREADED, objLogInfo);
                    message.value = message.value.toString(); // To Convert buffer to String while using RdKafka Npm...
                    var topicName = message.topic;
                    var topicData = JSON.parse(message.value);
                    var data = topicData.DATA;
                    var routingkey = topicData.ROUTINGKEY;
                    var logInfoFromData = topicData.LOG_INFO;

                    if (routingkey) {
                        headers.routingkey = routingkey;
                        objLogInfo.ROUTINGKEY = routingkey;
                    }

                    // Updating All the Information From the Kafka Topic Data into objLogInfo
                    objLogInfo.headers = headers;
                    objLogInfo.LOGIN_NAME = logInfoFromData.LOGIN_NAME;
                    objLogInfo.CLIENTIP = logInfoFromData.CLIENTIP;
                    objLogInfo.TIMEZONE_INFO = logInfoFromData.TIMEZONE_INFO;
                    objLogInfo.USER_ID = logInfoFromData.USER_ID;
                    objLogInfo.CLIENTTZ = logInfoFromData.CLIENTTZ;
                    objLogInfo.CLIENTTZ_OFFSET = logInfoFromData.CLIENTTZ_OFFSET;
                    objLogInfo.SESSION_ID = logInfoFromData.SESSION_ID;
                    objLogInfo.APP_ID = logInfoFromData.APP_ID;

                    // Adding logInfoFromData to objLogInfo for Producing into topic
                    objLogInfo.LOG_INFO_FROM_DATA = logInfoFromData;

                    reqInstanceHelper.PrintInfo(serviceName, '\n', objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '************************************************', objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      ' + topicName + ' KAFKA TOPIC DATA       ', objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      TIMEZONE_INFO - ' + JSON.stringify(objLogInfo.TIMEZONE_INFO), objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      CLIENTIP - ' + objLogInfo.CLIENTIP, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      CLIENTTZ - ' + objLogInfo.CLIENTTZ, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      CLIENTTZ_OFFSET - ' + objLogInfo.CLIENTTZ_OFFSET, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      APP_ID - ' + objLogInfo.APP_ID, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      TRN_ID - ' + data.trn_id, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      TYPE - ' + data.type, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      CREATED_DATE - ' + data.created_date, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      PRCT_ID - ' + data.prct_id, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      WFTPA_ID - ' + data.wftpa_id, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      EVENT_CODE - ' + data.event_code, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      Template Code - ' + data.commmt_code, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      TENANT_ID - ' + data.tenant_id, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      ROUTINGKEY - ' + routingkey, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '************************************************\n', objLogInfo);

                    var prsedMsg = JSON.parse(data.message);
                    if (prsedMsg.sessInfo && prsedMsg.sessInfo.NEED_PERSIST) {
                        var condObj = {};
                        var updateData = {};
                        condObj.comm_msg_id = data.comm_msg_id;
                        var UpdateCommProcessMsgResult = {};
                        updateData.status = data.status;
                        updateData.modified_date = data.modified_date;
                        updateData.comments = data.comments;

                        // Closing The Connection 
                        // reqInstanceHelper.DestroyConn(serviceName, objLogInfo, function () { });

                        reqInstanceHelper.PrintInfo(serviceName, 'Going to Update the "COMM_PROCESS_MESSAGE" Table...', objLogInfo);
                        reqTranDBHelper.GetTranDBConn(headers, false, function (tran_db_instance) {
                            reqTranDBHelper.UpdateTranDBWithAudit(tran_db_instance, 'COMM_PROCESS_MESSAGE', updateData, condObj, objLogInfo, function (result, error) {
                                if (error) {
                                    UpdateCommProcessMsgResult.status = 'FAILURE';
                                    UpdateCommProcessMsgResult.errorObj = error;
                                    UpdateCommProcessMsgResult.strInfo = 'Error While Updating Data in the COMM_PROCESS_MESSAGE Table...';
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_COMM_PROCESS_MSG_SUCCESS_CONSUMER_00001', UpdateCommProcessMsgResult.strInfo, error);
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Update the "COMM_PROCESS_MESSAGE" Table Process Completed...', objLogInfo);
                                    reqInstanceHelper.DestroyConn(serviceName, objLogInfo, function () {
                                        return;
                                    });
                                }
                            });
                        });
                    } else {
                        return;
                    }

                } catch (error) {
                    UpdateCommProcessMsgResult.status = 'FAILURE';
                    UpdateCommProcessMsgResult.errorObj = error;
                    UpdateCommProcessMsgResult.strInfo = 'Catch Error While Updating Data in the COMM_PROCESS_MESSAGE Table...';
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_COMM_PROCESS_MSG_SUCCESS_CONSUMER_00002', UpdateCommProcessMsgResult.strInfo, error);
                }
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, ' ERR-ATMT-CONSUMER-0002', 'Catch Error in startConsuming()...', error);
    }
}

function GetObjLogInfo() {
    try {
        return reqLogWriter.GetLogInfo('COMM_PROCESS_MSG_SUCCESS_CONSUMER', 'COMM_PROCESS_MSG_SUCCESS_CONSUMER_PROCESS', 'COMM_PROCESS_MSG_SUCCESS_CONSUMER_ACTION', logFilePath);
    } catch (error) {
        return {};
    }
}

module.exports = {
    StartConsuming: startConsuming,
    GetObjLogInfo: GetObjLogInfo
};
/******** End of File **********/
