/****
  Descriptions - To consume TRAN_DATA topic to prepare auditing data in solr  
  @Last_Error_Code              : ERR_COMMPROCESSDATACONSUMER_005
  @Changes		                : Path changes
 ****/

// Require dependencies
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var logFilePath = 'bgprocess/consumer/commprocessdataconsumer';
var reqFXDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqTranDBHelper = require('../../../../../torus-references/instance/TranDBInstance');
var reqComm = require('../../../../../torus-references/communication/core/SendMessage');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var reqProducer = require('../../../../../torus-references/common/Producer');
var reqSrvHlpr = require('../helper/ServiceHelper');
var reqAsync = require('async');
var uuid = require('node-uuid');

var serviceName = 's_CONSUMER';

// Starting consumer for topic COMM_PROCESS_DATA
var dlqTopicName = 'DLQ_COMM_PROCESS_DATA'
async function startConsuming(pConsumerName, pTopic, pConsumer, pKafka) {
    try {
        var objLogInfo = {};
        reqInstanceHelper.PrintInfo(pConsumerName, 'Started Consumer For ' + pTopic, objLogInfo);
        reqLogWriter.EventUpdate(objLogInfo);
        var mOrm = 'knex';

        var optionalParams = pKafka.OPTIONAL_PARAMS;
        var isTenantMultiThreaded = optionalParams.IS_TENANT_MULTI_THREADED;
        await pConsumer.run({
            // autoCommit: false,
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    objLogInfo = GetObjLogInfo(); // This Is To Get Unique Connection ID Which Helps To Filter The Log
                    objLogInfo.IS_TENANT_MULTI_THREADED = isTenantMultiThreaded; // Storing  Tenant Multi Threaded Control
                    var strRoutingKey = '';
                    var headers = {
                        LOG_INFO: objLogInfo
                    };
                    reqInstanceHelper.PrintInfo(serviceName, 'IS_TENANT_MULTI_THREADED - ' + objLogInfo.IS_TENANT_MULTI_THREADED, objLogInfo);
                    message.value = message.value.toString(); // To Convert buffer to String while using RdKafka Npm...
                    var topicName = message.topic;
                    var topicData = JSON.parse(message.value);
                    var logInfoFromData = topicData.LOG_INFO;
                    var rows = topicData.DATA.TRAN_DETAILS;
                    var comm_atmt = topicData.DATA.ATMT_DETAILS;
                    var data = rows[0] || {};
                    var NeedPresist = true;
                    if (data.SESSION_INFO) {
                        var parsedData = JSON.parse(data.SESSION_INFO);
                        // strRoutingKey = parsedData.ROUTINGKEY;
                        NeedPresist = parsedData.NEED_PERSIST;
                    }
                    strRoutingKey = data.ROUTINGKEY;
                    objLogInfo.ROUTINGKEY = strRoutingKey;
                    headers.routingkey = strRoutingKey;

                    // Case Updating All the Information From the Kafka Topic Data into objLogInfo
                    objLogInfo.headers = headers;
                    objLogInfo.LOGIN_NAME = logInfoFromData.LOGIN_NAME;
                    objLogInfo.CLIENTIP = logInfoFromData.CLIENTIP;
                    objLogInfo.TIMEZONE_INFO = logInfoFromData.TIMEZONE_INFO;
                    objLogInfo.USER_ID = logInfoFromData.USER_ID;
                    objLogInfo.CLIENTTZ = logInfoFromData.CLIENTTZ;
                    objLogInfo.CLIENTTZ_OFFSET = logInfoFromData.CLIENTTZ_OFFSET;
                    objLogInfo.SESSION_ID = logInfoFromData.SESSION_ID;
                    objLogInfo.APP_ID = logInfoFromData.APP_ID;
                    objLogInfo.TENANT_ID = logInfoFromData.TENANT_ID;


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
                    reqInstanceHelper.PrintInfo(serviceName, '      TRN_ID - ' + data.TRN_ID, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      DT_CODE - ' + data.DT_CODE, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      DTT_CODE - ' + data.DTT_CODE, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      WFTPA_ID - ' + data.WFTPA_ID, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      EVENT_CODE - ' + data.EVENT_CODE, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      PRCT_ID - ' + data.PRCT_ID, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      Template Code - ' + data.COMMMG_CODE, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      TENANT_ID - ' + data.TENANT_ID, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      ROUTINGKEY - ' + data.ROUTINGKEY, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      NEEDPRESIST - ' + NeedPresist, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      STATIC_DATA EXISTED  - ' + (data.STATIC_DATA ? true : false), objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '************************************************\n', objLogInfo);


                    mainfunction(headers, rows, comm_atmt, NeedPresist);




                    async function mainfunction(headers, arrTran, comm_atmt, NeedPresist) {
                        try {
                            var objLogInfo = headers.LOG_INFO;
                            reqFXDBInstance.GetFXDBConnection(headers, 'clt_cas', objLogInfo, async function (cltSession) {
                                try {
                                    reqFXDBInstance.GetFXDBConnection(headers, 'dep_cas', objLogInfo, async function (depSession) {
                                        try {
                                            reqFXDBInstance.GetFXDBConnection(headers, 'res_cas', objLogInfo, async function (resSession) {
                                                try {
                                                    reqTranDBHelper.GetTranDBConn(headers, false, async function (TranDbsession) {
                                                        try {
                                                            async function _insertCommPrcessData(arrTran, callbackfunction) {
                                                                try {
                                                                    if (!arrTran[0].COMMMG_CODE) {
                                                                        var errorInfo = 'Comm Category Code is Missed from the Param...';
                                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_COMMPROCESSDATACONSUMER_001', errorInfo, '');
                                                                        //  Marking the comm process data as processed 
                                                                        arrTran[0].is_processed = 'Y';
                                                                        arrTran[0].comments = errorInfo;
                                                                    }
                                                                    var addInfo = arrTran[0].ADDRESSINFO;
                                                                    delete arrTran[0].ADDRESSINFO;
                                                                    reqTranDBHelper.InsertTranDBWithAudit(TranDbsession, 'COMM_PROCESS_DATA', arrTran, objLogInfo, async function callbackInsertCommProcessData(pResult, pError) {
                                                                        if (pError) {
                                                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_COMMPROCESSDATACONSUMER_004', 'Error occured while insert comm process data.', pError);

                                                                            topicData.error = pError.stack;
                                                                            await dlqInsert(topicData)

                                                                        } else {
                                                                            arrTran[0]['ADDRESSINFO'] = addInfo
                                                                            callbackfunction(arrTran);
                                                                        }
                                                                    });
                                                                } catch (error) {
                                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_COMMPROCESSDATACONSUMER_005', 'Exception occured while insert comm process data.', error);
                                                                    topicData.error = error.stack;
                                                                    await dlqInsert(topicData)
                                                                }
                                                            } if (NeedPresist) {
                                                                _insertCommPrcessData(arrTran, prepareMessage);
                                                            } else {
                                                                prepareMessage(arrTran);
                                                            }

                                                            function prepareMessage(Res) {
                                                                try {
                                                                    _PrintInfo('Comm Category Code - ' + JSON.stringify(Res[0]), objLogInfo);

                                                                    _PrintInfo('Comm Category Code - ' + Res[0].COMMMG_CODE, objLogInfo);
                                                                    // Checking the  Commmg Code from params
                                                                    if (!Res[0].COMMMG_CODE) {
                                                                        var errorInfo = 'Comm Category Code is Missed from the Param...';
                                                                        console.log(errorInfo);
                                                                        return;
                                                                    } else if (Res[0].SESSION_INFO) {
                                                                        var sessioninfo = JSON.parse(Res[0].SESSION_INFO);
                                                                        sessioninfo.event_code = Res[0].EVENT_CODE;
                                                                        sessioninfo.wftpa_id = Res[0].WFTPA_ID;
                                                                        sessioninfo.dt_code = Res[0].DT_CODE;
                                                                        sessioninfo.dtt_code = Res[0].DTT_CODE;


                                                                        //  Process Modeller setup
                                                                        var whereCond = {};
                                                                        whereCond.commmg_code = Res[0].COMMMG_CODE;
                                                                        whereCond.wftpa_id = Res[0].WFTPA_ID;
                                                                        whereCond.event_code = Res[0].EVENT_CODE;
                                                                        // whereCond.app_id = sessioninfo.APP_ID;
                                                                        var staticCommProcessData = Res[0].STATIC_DATA;
                                                                        var PrctId = Res[0].PRCT_ID;
                                                                        sessioninfo.staticCommProcessData = staticCommProcessData;
                                                                        sessioninfo.TENANT_ID = Res[0].TENANT_ID;
                                                                        getcommTemplateDeatil(whereCond).then((template) => {
                                                                            if (template.length) {
                                                                                gettranquerydetail(PrctId, template, sessioninfo, Res);
                                                                            } else {
                                                                                _PrintInfo('Template Not available with event code wftpa id, check with DEFAULT .', objLogInfo);
                                                                                // UI Modeller Get data from COMM_INFO table with wftpa_id dt, dtt event code as "DEFAULT" 
                                                                                var defaultWhereCOnd = {};
                                                                                defaultWhereCOnd.commmg_code = Res[0].COMMMG_CODE;
                                                                                defaultWhereCOnd.wftpa_id = "DEFAULT";
                                                                                defaultWhereCOnd.event_code = "DEFAULT";
                                                                                defaultWhereCOnd.dt_code = "DEFAULT";
                                                                                defaultWhereCOnd.dtt_code = "DEFAULT";
                                                                                defaultWhereCOnd.app_id = '0';
                                                                                getcommTemplateDeatil(defaultWhereCOnd).then((defaultTemplate) => {
                                                                                    if (defaultTemplate.length) {
                                                                                        _PrintInfo('Got template with DEFAULT value.', objLogInfo);
                                                                                        gettranquerydetail(PrctId, defaultTemplate, sessioninfo, Res);
                                                                                    } else {
                                                                                        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR_COMMPROCESSDATACONSUMER_002', 'Template Not available for COMMMG_CODE - ' + Res[0].COMMMG_CODE, '');
                                                                                        //  Marked the comm process data as processed 
                                                                                        var updaterow = {};
                                                                                        updaterow.is_processed = 'Y';
                                                                                        updaterow.comments = 'Template Not available';
                                                                                        var updatecond = {};
                                                                                        updatecond.prct_id = PrctId;
                                                                                        updatecond.commmg_code = Res[0].COMMMG_CODE;
                                                                                        updatetable('COMM_PROCESS_DATA', updaterow, updatecond, objLogInfo).then(function () {
                                                                                            console.log('COMM_PROCESS_DATA updated successfully');
                                                                                        });
                                                                                    }
                                                                                }).catch(async (error) => {
                                                                                    _PrintInfo('Exception occured getcommTemplateDeatil | 2 ' + error, objLogInfo);
                                                                                    await dlqInsert()
                                                                                });
                                                                            }
                                                                        }).catch((error) => {
                                                                            console.log(error);
                                                                            var updareRow = {
                                                                                is_processed: 'Y',
                                                                                comments: error.message
                                                                            };
                                                                            var updareCond = {
                                                                                prct_id: PrctId,
                                                                            };
                                                                            if (Res[0].COMMMG_CODE) {
                                                                                updareCond.commmg_code = Res[0].COMMMG_CODE;
                                                                            }
                                                                            reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR_COMMPROCESSDATACONSUMER_003', Res[0].COMMMG_CODE + ' Catch Error in getcommTemplateDeatil()', error);
                                                                            updatetable('COMM_PROCESS_DATA', updareRow, updareCond, objLogInfo).then(function () {
                                                                                _PrintInfo('COMM_PROCESS_DATA updated successfully', objLogInfo);
                                                                            }).catch(async (error) => {
                                                                                topicData.error = error.stack
                                                                                await dlqInsert(topicData)
                                                                            })
                                                                        });

                                                                    } else {
                                                                        var updareRow = {
                                                                            is_processed: 'Y',
                                                                            comments: "SESSION_INFO column is null.It required to create comm_process_message data"
                                                                        };
                                                                        var updareCond = {
                                                                            prct_id: Res[0].PRCT_ID
                                                                        };
                                                                        if (Res[0].COMMMG_CODE) {
                                                                            updareCond.commmg_code = Res[0].COMMMG_CODE;
                                                                        }
                                                                        updatetable('COMM_PROCESS_DATA', updareRow, updareCond, objLogInfo).then(function () {
                                                                            _PrintInfo('COMM_PROCESS_DATA updated successfully', objLogInfo);
                                                                        }).catch(async (error) => {
                                                                            topicData.error = error.stack
                                                                            await dlqInsert(topicData)
                                                                        });
                                                                    }
                                                                } catch (error) {
                                                                    var updareRow = {
                                                                        is_processed: 'Y',
                                                                        comments: error.message
                                                                    };
                                                                    var updareCond = {
                                                                        prct_id: Res[0].PRCT_ID
                                                                    };
                                                                    if (Res[0].COMMMG_CODE) {
                                                                        updareCond.commmg_code = Res[0].COMMMG_CODE;
                                                                    }
                                                                    updatetable('COMM_PROCESS_DATA', updareRow, updareCond, objLogInfo).then(function () {
                                                                        _PrintInfo('COMM_PROCESS_DATA updated successfully', objLogInfo);
                                                                    }).catch(async (error) => {
                                                                        topicData.error = error.stack
                                                                        await dlqInsert(topicData)
                                                                    });
                                                                }
                                                            }

                                                            function gettranquerydetail(prctid, ptemplates, sessInfo, RowFromreq) {
                                                                try {
                                                                    // ptemplates[0].comm_type = 'KAFKA'
                                                                    if (ptemplates.length && ptemplates[0].comm_type.toUpperCase() == "KAFKA") {
                                                                        _PrintInfo(' Communication type |  ' + ptemplates[0].comm_type.toUpperCase(), objLogInfo);
                                                                        // var insertObj = {}; 
                                                                        // insertarr.push(insertObj); 
                                                                        var strTemp_info = JSON.parse(ptemplates[0].template_info)
                                                                        var priortyInfo = JSON.parse(strTemp_info.TEMP_INFO)
                                                                        var SCHEDULE = {
                                                                            "PRIORITY": priortyInfo.PRIORITY,
                                                                            "RETRY_COUNT": priortyInfo.RETRY_COUNT,
                                                                            "RETRY_INTERVAL": priortyInfo.RETRY_INTERVAL,
                                                                            "SCOPES": priortyInfo.SCOPES,
                                                                            "CONFIG_SETUP": priortyInfo.CONFIGSETUP
                                                                        };
                                                                        var data = {};
                                                                        sessInfo.commmt_code = ptemplates[0].commmt_code
                                                                        data.message = RowFromreq[0].STATIC_DATA;
                                                                        data.SCHEDULE = SCHEDULE;
                                                                        data.sessInfo = sessInfo;
                                                                        var insertObj = {};
                                                                        insertObj.message = JSON.stringify(data);
                                                                        insertObj.type = 'KAFKA';
                                                                        insertObj.created_date = reqDateFormatter.GetCurrentDate(headers);
                                                                        insertObj.prct_id = prctid;
                                                                        insertObj.wftpa_id = sessInfo.wftpa_id;
                                                                        insertObj.event_code = sessInfo.event_code;
                                                                        insertObj.status = 'CREATED';
                                                                        insertObj.created_by = sessInfo.U_ID;
                                                                        insertObj.attempt_count = 1;
                                                                        insertObj.commmt_code = sessInfo.commmt_code;
                                                                        insertObj.comm_msg_id = uuid.v1();
                                                                        insertObj.tenant_id = sessInfo.TENANT_ID;

                                                                        var insertarr = [];
                                                                        insertarr.push(insertObj)

                                                                        CommProcessMsgInsert(insertarr, function () {
                                                                            _PrintInfo('Data produced to kafka ', objLogInfo);
                                                                            return
                                                                        });
                                                                    } else {
                                                                        _PrintInfo('Getting trn and trna data from comm info table ', objLogInfo);
                                                                        reqAsync.forEachOfSeries(ptemplates, function (pTemplt, idx, pCallback) {
                                                                            var strData = [];
                                                                            reqAsync.parallel({
                                                                                TRN_QUERY: function (parCB) {
                                                                                    // Get Trn details  
                                                                                    reqSrvHlpr.GetTRNDetails(TranDbsession, mOrm, depSession, pTemplt.trn_qry, sessInfo.APP_ID, sessInfo.dt_code, sessInfo.dtt_code, pTemplt.wftpa_id, sessInfo.U_ID, prctid, objLogInfo, pTemplt, sessInfo, function callback(pResult, pTemplt, pStatusObj) {
                                                                                        if (pStatusObj.Status == 'SUCCESS') {
                                                                                            if (pResult)
                                                                                                strData = pResult.rows;
                                                                                            // For delete case no rows will be return on query - In that case assign input data

                                                                                            // Need to verify 
                                                                                            // Get User mailID / MobileNo from FX DB (USERS table)
                                                                                            var type = JSON.parse(pTemplt.category_info).COMMC_CONFIG.CONFIG.TYPE;
                                                                                            var ContactInfo = JSON.parse(pTemplt.contact_info);
                                                                                            reqSrvHlpr.GetEmailIDFromFXDB(cltSession, strData, ContactInfo, sessInfo.APP_ID, sessInfo.CLIENT_ID, type, objLogInfo, function callbackGetEmailIDfromFXDB(pData, pContacts, pStatusObj) {
                                                                                                pTemplt.CONTACT_INFOs = pContacts;
                                                                                                parCB(null, pData, pTemplt, pStatusObj);
                                                                                            });
                                                                                        } else {
                                                                                            parCB(null, strData, pTemplt, pStatusObj);
                                                                                        }
                                                                                    });
                                                                                },
                                                                                TRNA_QUERY: function (parCB) {
                                                                                    // Get Attachments                                    
                                                                                    reqSrvHlpr.GetAttachments(TranDbsession, resSession, depSession, pTemplt.trna_qry, pTemplt.commmt_code, sessInfo.APP_ID, sessInfo.dt_code, sessInfo.dtt_code, pTemplt.wftpa_id, sessInfo.U_ID, prctid, sessInfo.TRAN_DATA, objLogInfo, function callback(pATTObject) {
                                                                                        var arrATT = [];
                                                                                        if (pATTObject.Status == 'SUCCESS') {
                                                                                            arrATT = pATTObject.Data.rows;
                                                                                        }
                                                                                        parCB(null, arrATT, pATTObject);
                                                                                    });
                                                                                }
                                                                            }, function (err, result) {
                                                                                try {
                                                                                    if (result.TRN_QUERY[2].Status == 'SUCCESS') { // If TRN_QRY query fails
                                                                                        // if BOTH are Success
                                                                                        strData = result.TRN_QUERY[0];
                                                                                        _PrintInfo('------------- Template TRN Query - ' + pTemplt.trn_qry + ' -------------', objLogInfo);
                                                                                        _PrintInfo('------------- Template Group Code - ' + pTemplt.commmg_code + ' Template Code - ' + pTemplt.commmt_code + ' -------------', objLogInfo);
                                                                                        _PrintInfo('------------- TRN Query Result Count - ' + strData.length + ' -------------', objLogInfo);
                                                                                        var template = result.TRN_QUERY[1];
                                                                                        template.TEMPLATE_INFO = JSON.parse(template.template_info);
                                                                                        template.CATEGORY_INFO = JSON.parse(template.category_info);
                                                                                        // template.ATTACHMENTs = result.TRNA_QUERY[0];
                                                                                        var atmtInfo = {};
                                                                                        atmtInfo.DYNAMICATMT = false;
                                                                                        if (result.TRNA_QUERY[0] && result.TRNA_QUERY[0].length) {
                                                                                            var atmtRes = result.TRNA_QUERY[0];
                                                                                            atmtInfo.DYNAMICATMT = true;
                                                                                            atmtInfo.DYNAMICATMTDATA = atmtRes;
                                                                                        }
                                                                                        if (comm_atmt) {
                                                                                            atmtInfo.ISCOMMATMT = true;
                                                                                            atmtInfo.COMATMTDATA = comm_atmt;
                                                                                        } else {
                                                                                            atmtInfo.ISCOMMATMT = false;
                                                                                            atmtInfo.COMATMTDATA = [];
                                                                                        }
                                                                                        template.ATMTINFOS = atmtInfo;
                                                                                        if (template.comm_type.toUpperCase() == 'MAIL') {
                                                                                            preparemailcomminsert(template, strData, prctid, sessInfo, objLogInfo, RowFromreq).then(function () {
                                                                                                //  Marked the comm process data as processed 
                                                                                                pCallback();
                                                                                            }).catch((err) => {
                                                                                                _PrintInfo('preparemailcomminsert err' + err, objLogInfo);
                                                                                                // Need to update  status
                                                                                                pCallback();
                                                                                            });
                                                                                        } else if (template.comm_type.toUpperCase() == 'SMS') {
                                                                                            preparesmscomminsert(template, strData, prctid, sessInfo, objLogInfo, RowFromreq).then(function () {
                                                                                                pCallback();
                                                                                            });
                                                                                        }
                                                                                    } else {
                                                                                        pCallback();
                                                                                    }
                                                                                } catch (error) {
                                                                                    _PrintInfo('reqAsync.parallel final callback err' + error, objLogInfo);
                                                                                }
                                                                            });
                                                                        }, function (error) {
                                                                            var updareRow = {
                                                                                is_processed: 'Y',
                                                                            };
                                                                            if (error) {
                                                                                updareRow.comments = error;
                                                                            }
                                                                            var updareCond = {
                                                                                prct_id: prctid,
                                                                            };
                                                                            updatetable('COMM_PROCESS_DATA', updareRow, updareCond, objLogInfo).then(function () {
                                                                                console.log('COMM_PROCESS_DATA updated successfully');
                                                                            });

                                                                        });
                                                                    }

                                                                } catch (error) {
                                                                    _PrintInfo('Exception occured updatetable ' + error, objLogInfo);
                                                                    var updareRow = {
                                                                        is_processed: 'Y',
                                                                        comments: error
                                                                    };
                                                                    var updareCond = {
                                                                        prct_id: prctid
                                                                    };
                                                                    updatetable('COMM_PROCESS_DATA', updareRow, updareCond, objLogInfo).then(function () {

                                                                    }).catch(async (error) => {
                                                                        topicData.error = error.stack
                                                                        await dlqInsert(topicData)
                                                                    });
                                                                }
                                                            }

                                                            //  Get Comm template detail
                                                            function getcommTemplateDeatil(whereCond) {
                                                                try {
                                                                    return new Promise(function (resolve, reject) {
                                                                        // Find the template code from comm info table
                                                                        _PrintInfo('Getting communication template from comm info table', objLogInfo);
                                                                        reqFXDBInstance.GetTableFromFXDB(depSession, 'COMM_INFO', [], whereCond, objLogInfo, function (pErr, pRes) {
                                                                            if (pErr) {
                                                                                reject(pErr);
                                                                            } else {
                                                                                resolve(pRes.rows);
                                                                            }
                                                                        });
                                                                    });
                                                                } catch (error) {
                                                                    _PrintInfo('Exception occured updatetable ' + error, objLogInfo);
                                                                    reject(error)
                                                                }
                                                            }


                                                            // To prepare the mail message for sending mail
                                                            function preparemailcomminsert(pTemplate, pData, prctid, psessInfo, pLogInfo, RowFromreq) {
                                                                _PrintInfo('Prepare mail object ', objLogInfo);
                                                                return new Promise((resolve, reject) => {
                                                                    try {
                                                                        var ObjAdress = {};
                                                                        var mailstatus = "";
                                                                        _PrintInfo('Mail prepare for comm mode | ' + pTemplate.TEMPLATE_INFO.COMMMT_MODE, objLogInfo);
                                                                        var insertarr = [];
                                                                        if (pData.length) {
                                                                            reqAsync.forEachOfSeries(pData, function (row, indx, mailcallback) {
                                                                                var insertObj = {};
                                                                                if (pTemplate.TEMPLATE_INFO.COMMMT_MODE.toUpperCase() == 'INDIVIDUAL') {
                                                                                    insertObj = prepareMailMesg(pTemplate, row, 'Individual', prctid, pLogInfo, psessInfo, RowFromreq);
                                                                                } else {
                                                                                    _PrintInfo('Communication MODE is GROUP', pLogInfo);
                                                                                    insertObj = prepareMailMesg(pTemplate, row, 'Group', prctid, pLogInfo, psessInfo, RowFromreq);
                                                                                }
                                                                                insertarr.push(insertObj);
                                                                                mailcallback();
                                                                            }, function (error) {
                                                                                if (error) {
                                                                                    _PrintInfo('Error occured _MailPreparation function ' + error, pLogInfo);
                                                                                    resolve(error);
                                                                                } else {
                                                                                    _PrintInfo('reqAsync.forEachSeries success ' + mailstatus, pLogInfo);
                                                                                    CommProcessMsgInsert(insertarr, function () {
                                                                                        resolve();
                                                                                    });
                                                                                }
                                                                            });
                                                                        } else {
                                                                            var insertObj = {};

                                                                            if (pTemplate.TEMPLATE_INFO.COMMMT_MODE.toUpperCase() == 'INDIVIDUAL') {
                                                                                insertObj = prepareMailMesg(pTemplate, [], 'Individual', prctid, pLogInfo, psessInfo, RowFromreq);
                                                                            } else {
                                                                                _PrintInfo('Communication MODE is GROUP', pLogInfo);
                                                                                insertObj = prepareMailMesg(pTemplate, [], 'Group', prctid, pLogInfo, psessInfo, RowFromreq);
                                                                            }
                                                                            insertarr.push(insertObj);
                                                                            CommProcessMsgInsert(insertarr, function () {
                                                                                resolve();
                                                                            });
                                                                        }

                                                                    } catch (ex) {
                                                                        _PrintInfo('Exception occured ' + ex, objLogInfo);

                                                                        var updaterow = {};
                                                                        updaterow.is_processed = 'Y';
                                                                        updaterow.comments = JSON.stringify(ex);
                                                                        var updatecond = {};
                                                                        updatecond.prct_id = prctid;
                                                                        updatetable('COMM_PROCESS_DATA', updaterow, updatecond, objLogInfo).then(function (updateRes) {
                                                                            _PrintInfo('COMM_PROCESS_DATA processed successfully', objLogInfo);
                                                                            resolve(ex);
                                                                        }).catch(function (error) {
                                                                            _PrintInfo('Error occured while update comm process data table' + error, objLogInfo);
                                                                        });

                                                                    }
                                                                });
                                                            }


                                                            function prepareMailMesg(pTemplate, row, typeofmethod, prctid, pLogInfo, psessInfo, RowFromreq) {
                                                                try {

                                                                    var strTemp_info = JSON.parse(pTemplate.TEMPLATE_INFO.TEMP_INFO);
                                                                    // Individual
                                                                    var ObjAdress = {};
                                                                    ObjAdress.IsBodyHtml = true; //Attachment
                                                                    // PREPARE TO ADDRESS
                                                                    var Toaddr = [];
                                                                    var Ccaddr = [];
                                                                    var Bccaddr = [];

                                                                    if (RowFromreq.length && RowFromreq[0].ADDRESSINFO && RowFromreq[0].ADDRESSINFO.BCC) {
                                                                        Bccaddr.push(RowFromreq[0].ADDRESSINFO.BCC)
                                                                    }
                                                                    if (RowFromreq.length && RowFromreq[0].ADDRESSINFO && RowFromreq[0].ADDRESSINFO.CC) {
                                                                        Ccaddr.push(RowFromreq[0].ADDRESSINFO.CC)
                                                                    }
                                                                    if (RowFromreq.length && RowFromreq[0].ADDRESSINFO && RowFromreq[0].ADDRESSINFO.TO) {
                                                                        Toaddr.push(RowFromreq[0].ADDRESSINFO.TO)
                                                                    }

                                                                    for (var i = 0; i < pTemplate.CONTACT_INFOs.length; i++) {
                                                                        var addr = pTemplate.CONTACT_INFOs[i];
                                                                        // TO
                                                                        var functionName = reqComm['GetDestAddress' + typeofmethod];

                                                                        if (addr.ADDRESS_TYPE.toUpperCase() === 'TO') {
                                                                            if (addr.STATIC_ADDRESS && addr.STATIC_ADDRESS.indexOf('$Emailid') > -1) {
                                                                                Toaddr.push(row.TO_EMAIL_ID);
                                                                            } else {
                                                                                Toaddr.push(functionName(addr, row));
                                                                            }
                                                                        }
                                                                        // CC
                                                                        if (addr.ADDRESS_TYPE.toUpperCase() === 'CC')
                                                                            Ccaddr.push(functionName(addr, row));
                                                                        // BCC
                                                                        if (addr.ADDRESS_TYPE.toUpperCase() === 'BCC')
                                                                            Bccaddr.push(functionName(addr, row));
                                                                    }

                                                                    // TO
                                                                    if (Toaddr.length > 0)
                                                                        ObjAdress.To = Toaddr.join();

                                                                    // CC
                                                                    if (Ccaddr.length > 0)
                                                                        ObjAdress.Cc = Ccaddr.join();

                                                                    // BCC
                                                                    if (Bccaddr.length > 0)
                                                                        ObjAdress.Bcc = Bccaddr.join();

                                                                    var strMsg = pTemplate.TEMPLATE_INFO.COMMMT_MESSAGE.toString();
                                                                    var strSubject = pTemplate.TEMPLATE_INFO.COMMMT_SUBJECT.toString();
                                                                    strMsg = reqComm.PrepareMessage(strMsg, null, row, pLogInfo);

                                                                    //  Replacing TRN DETails Data also 
                                                                    // New Changes for the dotnet service, to send the encryted pdf atmts
                                                                    if (psessInfo.TRAN_DATA && psessInfo.TRAN_DATA.length) {
                                                                        strMsg = reqComm.PrepareMessage(strMsg, null, psessInfo.TRAN_DATA[0], pLogInfo);
                                                                    }

                                                                    strSubject = reqComm.PrepareMessage(strSubject, null, row, pLogInfo);
                                                                    var Mailinfo = {};
                                                                    Mailinfo.Message = strMsg;
                                                                    Mailinfo.Subject = strSubject;
                                                                    Mailinfo.Address = ObjAdress;
                                                                    Mailinfo.sessInfo = psessInfo;
                                                                    Mailinfo.ATTACHMENTINFOS = pTemplate.ATMTINFOS;
                                                                    Mailinfo.SCHEDULE = {
                                                                        "PRIORITY": strTemp_info.PRIORITY,
                                                                        "RETRY_COUNT": strTemp_info.RETRY_COUNT,
                                                                        "RETRY_INTERVAL": strTemp_info.RETRY_INTERVAL,
                                                                        "SCOPES": strTemp_info.SCOPES,
                                                                        "CONFIG_SETUP": strTemp_info.CONFIGSETUP
                                                                    };
                                                                    // insert object for comm process message
                                                                    var insertObj = {};
                                                                    insertObj.message = JSON.stringify(Mailinfo);
                                                                    insertObj.type = 'MAIL';
                                                                    insertObj.created_date = reqDateFormatter.GetCurrentDate(headers);
                                                                    insertObj.prct_id = prctid;
                                                                    insertObj.wftpa_id = psessInfo.wftpa_id;
                                                                    insertObj.event_code = psessInfo.event_code;
                                                                    insertObj.trn_id = row.trn_id;
                                                                    insertObj.status = 'CREATED';
                                                                    insertObj.created_by = psessInfo.U_ID;
                                                                    insertObj.attempt_count = 1;
                                                                    insertObj.commmt_code = pTemplate.commmt_code;
                                                                    insertObj.comm_msg_id = uuid.v1();
                                                                    insertObj.tenant_id = psessInfo.TENANT_ID;
                                                                    return insertObj;
                                                                } catch (error) {
                                                                    console.log(error);
                                                                }

                                                            }


                                                            function prepareSMSMesg(pTemplate, row, prctid, pLogInfo, psessInfo, RowFromreq) {
                                                                var strTemp_info = JSON.parse(pTemplate.TEMPLATE_INFO.TEMP_INFO);
                                                                var ObjMessage = {};
                                                                var functionName = '';

                                                                if (pTemplate.TEMPLATE_INFO.COMMMT_MODE.toUpperCase() == 'INDIVIDUAL') {
                                                                    functionName = reqComm['GetDestAddressIndividual'];
                                                                } else {
                                                                    functionName = reqComm['GetDestAddressGroup'];
                                                                }
                                                                var strMsg = pTemplate.TEMPLATE_INFO.COMMMT_MESSAGE;
                                                                strMsg = reqComm.PrepareMessage(strMsg, psessInfo.TRAN_DATA, row);
                                                                ObjMessage.Message = strMsg;

                                                                //  Replacing TRN DETails Data also 
                                                                // New Changes for the dotnet service, to send the encryted pdf atmts
                                                                if (psessInfo.TRAN_DATA && psessInfo.TRAN_DATA.length) {
                                                                    strMsg = reqComm.PrepareMessage(strMsg, null, psessInfo.TRAN_DATA[0], pLogInfo);
                                                                }

                                                                // Prepare TO Address
                                                                var Toaddr = [];
                                                                if (RowFromreq.length && RowFromreq[0].ADDRESSINFO && RowFromreq[0].ADDRESSINFO.TO_MOBILE_NO) {
                                                                    Toaddr = RowFromreq[0].ADDRESSINFO.TO_MOBILE_NO.replaceAll(' ', '').split(',')
                                                                }
                                                                for (var j = 0; j < pTemplate.CONTACT_INFOs.length; j++) {
                                                                    var addr = pTemplate.CONTACT_INFOs[j];
                                                                    // TO
                                                                    if (addr.ADDRESS_TYPE.toUpperCase() === 'TO') {
                                                                        if (addr.STATIC_ADDRESS && addr.STATIC_ADDRESS.indexOf('$MobileNo') > -1) {
                                                                            Toaddr.push(row.TO_MOBILE_NO);
                                                                        } else {
                                                                            Toaddr.push(functionName(addr, row));
                                                                        }
                                                                    }
                                                                }
                                                                if (Toaddr.length == 0) {
                                                                    _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20067', '', null, 'Destination not Available', callback);
                                                                } else {
                                                                    ObjMessage.To = Toaddr.join();
                                                                    ObjMessage.sessInfo = psessInfo;
                                                                    ObjMessage.SCHEDULE = {
                                                                        "PRIORITY": strTemp_info.PRIORITY,
                                                                        "RETRY_COUNT": strTemp_info.RETRY_COUNT,
                                                                        "RETRY_INTERVAL": strTemp_info.RETRY_INTERVAL,
                                                                        "SCOPES": strTemp_info.SCOPES,
                                                                        "CONFIG_SETUP": strTemp_info.CONFIGSETUP
                                                                    };
                                                                    var insertObj = {};
                                                                    insertObj.message = JSON.stringify(ObjMessage);
                                                                    insertObj.type = 'SMS';
                                                                    insertObj.created_date = reqDateFormatter.GetCurrentDate(headers);
                                                                    insertObj.prct_id = prctid;
                                                                    insertObj.wftpa_id = psessInfo.wftpa_id;
                                                                    insertObj.event_code = psessInfo.event_code;
                                                                    insertObj.trn_id = row.trn_id;
                                                                    insertObj.status = 'CREATED';
                                                                    insertObj.created_by = psessInfo.U_ID;
                                                                    insertObj.attempt_count = 1;
                                                                    insertObj.commmt_code = pTemplate.commmt_code;
                                                                    insertObj.comm_msg_id = uuid.v1();
                                                                    insertObj.tenant_id = psessInfo.TENANT_ID;
                                                                    return insertObj;
                                                                }
                                                            }


                                                            function CommProcessMsgInsert(insertarr, callback) {
                                                                var topicName = 'FX_COMM_PROCESS_MSG';
                                                                var routingKey = objLogInfo.ROUTINGKEY;
                                                                // if (objLogInfo.IS_TENANT_MULTI_THREADED) {
                                                                //     topicName = topicName + '_' + routingKey;
                                                                //     topicName = topicName.replace(/~/g, '_').toUpperCase(); // If Replace is Not Done then It will not create a Kfka Topic
                                                                // }
                                                                _PrintInfo('IS_TENANT_MULTI_THREADED - ' + objLogInfo.IS_TENANT_MULTI_THREADED, objLogInfo);
                                                                _PrintInfo('Topic Name - ' + topicName, objLogInfo);
                                                                if (NeedPresist) {
                                                                    _PrintInfo('COMM_PROCESS_MESSAGE insert started', objLogInfo);
                                                                    inserttable('COMM_PROCESS_MESSAGE', insertarr, objLogInfo).then(function (commsgid) {
                                                                        insertarr[0].commpm_id = commsgid
                                                                        _PrintInfo('COMM_PROCESS_MESSAGE insert Success', objLogInfo);
                                                                        // Closing The Connection 

                                                                        var connObjexts = [...objLogInfo.arrConns]
                                                                        // reqInstanceHelper.DestroyConn(serviceName, objLogInfo, function (params) {
                                                                        delete headers.LOG_INFO.arrConns;
                                                                        delete headers.LOG_INFO;
                                                                        var kafkaTopicData = { DATA: insertarr, ROUTINGKEY: routingKey, LOG_INFO: objLogInfo.LOG_INFO_FROM_DATA };
                                                                        reqProducer.ProduceMessage(topicName, kafkaTopicData, headers, async function caalback(res) {
                                                                            _PrintInfo('Data produced to topic | ' + topicName, objLogInfo);
                                                                            await pConsumer.commitOffsets([{ topic: topic, partition: partition, offset: message.offset }]);
                                                                            objLogInfo.arrConns = connObjexts
                                                                            callback();
                                                                        });
                                                                        // });
                                                                    }).catch(function (error) {
                                                                        _PrintInfo('Error occured inserttable MAIL COMM_PROCESS_MESSAGE' + error, objLogInfo);
                                                                        var updaterow = {};
                                                                        updaterow.is_processed = 'Y';
                                                                        updaterow.comments = JSON.stringify(error);
                                                                        var updatecond = {};
                                                                        updatecond.prct_id = prctid;
                                                                        updatetable('COMM_PROCESS_DATA', updaterow, updatecond, objLogInfo).then(function (updateRes) {
                                                                            _PrintInfo('COMM_PROCESS_DATA processed successfully', objLogInfo);
                                                                        }).catch(function (error) {
                                                                            _PrintInfo('Error occured while update comm process data table' + error, objLogInfo);
                                                                        });
                                                                    });
                                                                } else {
                                                                    reqProducer.ProduceMessage(topicName, insertarr, headers, function caalback(res) {
                                                                        reqInstanceHelper.DestroyConn(serviceName, objLogInfo, function (params) {
                                                                            callback();
                                                                        })
                                                                    });
                                                                }
                                                            }
                                                            // To prepare message and Send SMS
                                                            function preparesmscomminsert(pTemplate, pData, prctid, psessInfo, pLogInfo, RowFromreq) {
                                                                return new Promise((ResolveRes, rejecterr) => {
                                                                    var ObjMessage = {};
                                                                    try {
                                                                        _PrintInfo('Prepare sms comm mode is | ' + pTemplate.TEMPLATE_INFO.COMMMT_MODE, objLogInfo);
                                                                        var strTemp_info = JSON.parse(pTemplate.TEMPLATE_INFO.TEMP_INFO);
                                                                        var insertarr = [];
                                                                        if (pData.length) {
                                                                            reqAsync.forEachOfSeries(pData, function (row, index, smscallback) {
                                                                                var Insertobj = prepareSMSMesg(pTemplate, row, prctid, pLogInfo, psessInfo, RowFromreq);
                                                                                insertarr.push(Insertobj);
                                                                                smscallback();
                                                                            }, function (error) {
                                                                                if (error) {
                                                                                    _PrintInfo('Exception occured forEachOfSeries final callback ' + error, objLogInfo);
                                                                                } else {
                                                                                    CommProcessMsgInsert(insertarr, function () {
                                                                                        ResolveRes();
                                                                                    });
                                                                                }
                                                                            });
                                                                        } else {
                                                                            var Insertobj = prepareSMSMesg(pTemplate, pData, prctid, pLogInfo, psessInfo, RowFromreq);
                                                                            insertarr.push(Insertobj);
                                                                            CommProcessMsgInsert(insertarr, function () {
                                                                                ResolveRes();
                                                                            });
                                                                        }

                                                                    } catch (error) {
                                                                        _PrintInfo('Exception occured preparesmscomminsert ' + error, objLogInfo);
                                                                    }
                                                                });
                                                            }

                                                            // inert the data into tran DB 
                                                            function inserttable(ptargettbale, insertRows, pLogInfo) {
                                                                return new Promise((resolve, reject) => {
                                                                    try {
                                                                        _PrintInfo('insert started for table ' + ptargettbale);
                                                                        reqTranDBHelper.InsertTranDBWithAudit(TranDbsession, ptargettbale, insertRows, pLogInfo, function (InsertRes, insertErr) {
                                                                            if (insertErr) {
                                                                                reject(insertErr);
                                                                            } else {
                                                                                try {
                                                                                    _PrintInfo('insert success');
                                                                                    var commsgid = InsertRes[0].commpm_id;
                                                                                    resolve(commsgid);
                                                                                } catch (error) {
                                                                                    console.log('error ' + error);
                                                                                    reject(insertErr);
                                                                                }

                                                                            }
                                                                        });
                                                                    } catch (error) {
                                                                        _PrintInfo('Exception occured inserttable ' + error, objLogInfo);
                                                                        reject(error);
                                                                    }
                                                                });
                                                            }

                                                            function updatetable(ptargettbale, updaterow, updatecond, pLogInfo) {
                                                                return new Promise((resolve, reject) => {
                                                                    try {
                                                                        reqTranDBHelper.UpdateTranDBWithAudit(TranDbsession, ptargettbale, updaterow, updatecond, pLogInfo, async function (updateRes, UpdateErr) {
                                                                            if (UpdateErr) {
                                                                                reject(UpdateErr);
                                                                            } else {
                                                                                await destroyConn(pLogInfo)
                                                                                resolve();
                                                                            }
                                                                        });
                                                                    } catch (error) {
                                                                        _PrintInfo('Exception occured updatetable ' + error, objLogInfo);
                                                                        reject(error);
                                                                    }
                                                                });
                                                            }

                                                            function destroyConn(objLogInfo) {
                                                                return new Promise((resolve, reject) => {
                                                                    try {
                                                                        reqInstanceHelper.DestroyConn(serviceName, objLogInfo, function (params) {
                                                                            _PrintInfo('Connection Destroyed Successfully. ', objLogInfo);
                                                                            resolve()
                                                                        })

                                                                    } catch (error) {
                                                                        _PrintInfo('Exception occured while destroyed the connection. ' + error, objLogInfo);
                                                                        resolve()
                                                                    }

                                                                })

                                                            }
                                                        } catch (error) {
                                                            topicData.error = error.stack
                                                            await dlqInsert(topicData)
                                                        }
                                                    });
                                                } catch (error) {
                                                    topicData.error = error.stack
                                                    await dlqInsert(topicData)
                                                }
                                            });
                                        } catch (error) {
                                            topicData.error = error.stack
                                            await dlqInsert(topicData)
                                        }
                                    });
                                } catch (error) {
                                    topicData.error = error.stack
                                    await dlqInsert(topicData)
                                }
                            });
                        } catch (error) {
                            topicData.error = error.stack
                            await dlqInsert(topicData)
                        }
                    }
                    // dead letter queue insert 
                    function dlqInsert(pKafkaTopicData) {
                        reqProducer.ProduceMessage(dlqTopicName, pKafkaTopicData, headers, async function caalback(res) {
                            _PrintInfo('Data produced to topic | ' + dlqTopicName, objLogInfo);
                            // await pConsumer.commitOffsets([{ topic: topic, partition: partition, offset: message.offset }]);  
                        });
                    }
                } catch (error) {
                    topicData.error = error.stack
                    await dlqInsert(topicData)
                }
            }
        })

        function _PrintInfo(pMessage, pLogInfo) {
            reqInstanceHelper.PrintInfo('CommunicationConsumer', pMessage, pLogInfo);
        }
        /*
         * If consumer get `offsetOutOfRange` event, fetch data from the smallest(oldest) offset
         */
        // pConsumer.on('offsetOutOfRange', function (topic) {
        //     reqInstanceHelper.PrintWarn(pConsumerName, '------------- offsetOutOfRange ------------', objLogInfo);
        //     topic.maxNum = 2;
        //     pKafka.Offset.fetch([topic], function (err, offsets) {
        //         var min = Math.min.apply(null, offsets[topic.topic][topic.partition]);
        //         pConsumer.setOffset(topic.topic, topic.partition, min);
        //     });
        // });


    } catch (error) {
        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, ' ERR-ATMT-CONSUMER-0002', 'Catch Error in startConsuming()...', error);
    }
}

function GetObjLogInfo() {
    try {
        return reqLogWriter.GetLogInfo('COMM_PROCESS_DATA_CONSUMER', 'COMM_PROCESS_DATA_CONSUMER_PROCESS', 'COMM_PROCESS_DATA_CONSUMER_ACTION', logFilePath);
    } catch (error) {
        return {};
    }
}

module.exports = {
    StartConsuming: startConsuming,
    GetObjLogInfo: GetObjLogInfo
};
/******** End of File **********/