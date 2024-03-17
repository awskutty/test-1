/****
  Descriptions - To consume TRAN_DATA topic to prepare auditing data in solr  
  @Last_Error_Code              : ERR_COMM_MSG_SENDER_CONSUMER_0001
 ****/

// Require dependencies
var reqAsync = require('async');
var reqBase64 = require('base64-js');
var reqkafkaInstance = require('../../../../../torus-references/instance/KafkaInstance');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var logFilePath = 'bgprocess/consumer/commmessagesenderconsumer';
var reqThreadHelper = require('./ThreadHelper');
var serviceName = 'COMM_MSG_SENDER_CONSUMER';
var reqFXDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqSMTP = require('../../../../../torus-references/communication/core/mail/SMTPMessage');
var reqSMSAPI = require('../../../../../torus-references/communication/core/sms/SMS_API');
var reqsvchelper = require('../../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var uuid = require('uuid');
var path = require('path')
const { SchemaRegistry, SchemaType, avdlToAVSCAsync } = require('@kafkajs/confluent-schema-registry');
const { reject } = require('lodash');


// Starting consumer for topic TRAN_DATA
async function startConsuming(pConsumerName, pTopic, pConsumer, pKafka) {
    try {
        var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
        var initialLogInfo = {};
        reqInstanceHelper.PrintInfo(pConsumerName, 'Started Consumer For ' + pTopic, initialLogInfo);
        reqLogWriter.EventUpdate(initialLogInfo);

        var optionalParams = pKafka.OPTIONAL_PARAMS;
        var isTenantMultiThreaded = optionalParams.IS_TENANT_MULTI_THREADED;

        await pConsumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                try {

                    // dead letter queue insert 
                    function dlqInsert(pKafkaTopicData) {
                        return new Promise((resolve, reject) => {
                            var dlqTopicName = 'DLQ_FX_COMM_PROCESS_MSG';
                            var dlqInsertobj = {}
                            dlqInsertobj.objLogInfo = objLogInfo;
                            dlqInsertobj.headers = headers;
                            dlqInsertobj.kafkTopicName = dlqTopicName;
                            dlqInsertobj.commProcessMessageData = pKafkaTopicData;
                            reqThreadHelper.SendToKafka(dlqInsertobj, async function caalback(res) {
                                _PrintInfo('Data produced to topic | ' + dlqTopicName, objLogInfo);
                                resolve()
                            });
                        })
                    }

                    var objLogInfo = GetObjLogInfo(); // This Is To Get Unique Connection ID Which Helps To Filter The Log
                    objLogInfo.IS_TENANT_MULTI_THREADED = isTenantMultiThreaded; // Storing  Tenant Multi Threaded Control
                    var headers = {
                        LOG_INFO: objLogInfo
                    };
                    reqInstanceHelper.PrintInfo(serviceName, 'IS_TENANT_MULTI_THREADED - ' + objLogInfo.IS_TENANT_MULTI_THREADED, objLogInfo);
                    message.value = message.value.toString(); // To Convert buffer to String while using RdKafka Npm...
                    var topicName = message.topic;
                    var topicData = JSON.parse(message.value);
                    var routingkey = topicData.ROUTINGKEY;
                    var logInfoFromData = topicData.LOG_INFO;
                    var arrRows = topicData.DATA;
                    var data = arrRows[0];
                    var MessageObj = JSON.parse(data.message);
                    var TemplateCode = data.commmt_code;
                    // var RoutingKey = MessageObj.sessInfo.ROUTINGKEY;
                    var SetupCategory = MessageObj.SCHEDULE.CONFIG_SETUP; //Mail/sms setup get from tenant setup table

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


                    // Closing The Connection 
                    // reqInstanceHelper.DestroyConn(pConsumerName, objLogInfo, function () { }); 
                    //serviceModel.PLATFORM_VERSION = '7.0'
                    //   headers['routingkey'] = "NPSS";
                    //   var SetupCategory = "KAFKA";
                    //   objLogInfo.ROUTINGKEY = 'NPSS'
                    reqFXDBInstance.GetFXDBConnection(headers, 'clt_cas', objLogInfo, async function CallbackgetFXDBConn(pClientClt) {
                        try {
                            if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                                _PrintInfo('Plat form version is  | ' + serviceModel.PLATFORM_VERSION, objLogInfo);
                                _PrintInfo('SetupCategory is | ' + SetupCategory, objLogInfo);
                                if (SetupCategory == "NOTIFICATION_KAFKA") {
                                    // Getting external kafka connection
                                    _PrintInfo('Going to get external kafka connection ', objLogInfo);
                                    reqkafkaInstance.GetExtkafkaConn(objLogInfo, pClientClt, objLogInfo.ROUTINGKEY, 'NOTIFICATION_KAFKA', async function (pConnectionDtl) {
                                        try {
                                            _PrintInfo('Message Format |  ' + MessageObj.sessInfo.KAFKA_MSG_FORMAT, objLogInfo);
                                            _PrintInfo('registry url is  |  ' + process.env.registry_url ? 'available' : 'not available in evn variable', objLogInfo);
                                            if (MessageObj.sessInfo.KAFKA_MSG_FORMAT == 'AVRO') {
                                                try {
                                                    if (process.env.registry_url) {
                                                        var registry_config = {
                                                            host: process.env.registry_url,
                                                            ...(process.env.need_registry_auth == "Y" && {
                                                                auth: {
                                                                    username: process.env.registry_username,
                                                                    password: process.env.registry_password
                                                                }
                                                            })
                                                        }
                                                        var registry = new SchemaRegistry(registry_config, {
                                                            [SchemaType.AVRO]: { noAnonymousTypes: true }
                                                        });
                                                        if (!MessageObj.sessInfo.SCHEMA_ID && MessageObj.sessInfo.SCHEMA_FILE_PATH) {
                                                            // const schema = await avdlToAVSCAsync(path.join(MessageObj.sessInfo.SCHEMA_FILE_PATH, 'schema.avdl'))
                                                            const schema = await avdlToAVSCAsync(path.join(MessageObj.sessInfo.SCHEMA_FILE_PATH))
                                                            const { id } = await registry.register({ type: SchemaType.AVRO, schema: JSON.stringify(schema) })

                                                            // message encoding 
                                                            MessageObj.message = {
                                                                key: uuid.v4(),
                                                                value: await registry.encode(id, MessageObj.message)
                                                            }
                                                        } else if (MessageObj.sessInfo.SCHEMA_ID) {
                                                            // message encoding 
                                                            MessageObj.message = {
                                                                key: uuid.v4(),
                                                                value: await registry.encode(MessageObj.sessInfo.SCHEMA_ID, MessageObj.message)
                                                            }
                                                        } else {
                                                            _PrintInfo('Schema file and id is not available. not able to format avro. ', objLogInfo);
                                                        }

                                                    }

                                                } catch (error) {
                                                    _PrintInfo('Exception occured formating msg to avro | ' + error, objLogInfo);
                                                }
                                            }



                                            var mProducer = ''
                                            var kakfaProduceStatus = "SUCCESS";
                                            var errorStr = ''
                                            var extTopicName = MessageObj.sessInfo.EXT_TOPIC_NAME
                                            if (pConnectionDtl && pConnectionDtl.status == "SUCCESS") {
                                                _PrintInfo('Got the external kafka connection. ', objLogInfo);
                                                mProducer = pConnectionDtl.kafkaIns;
                                                var pTopicName = extTopicName ? extTopicName : pConnectionDtl.topicName
                                                pData = 'Ext kafka topic data'
                                                var res = await mProducer.send({
                                                    topic: pTopicName,
                                                    messages: [
                                                        { value: MessageObj.message },
                                                    ],
                                                })
                                                if (res.length) {
                                                    _PrintInfo('Data produced to external kafka topic | ' + pTopicName, objLogInfo);
                                                } else {
                                                    _PrintInfo('Failed to produce the data into external kafka. |' + pTopicName, objLogInfo);
                                                    kakfaProduceStatus = "FAILED"
                                                }
                                            } else {
                                                kakfaProduceStatus = "FAILED"
                                            }

                                            var SendToKafkaReqObj = {};

                                            var topicName = 'FX_COMM_PROCESS_MSG';
                                            var routingKey = objLogInfo.ROUTINGKEY;
                                            if (kakfaProduceStatus != "SUCCESS") {
                                                topicName = topicName + '_FAILURE';
                                                errorStr = "Failed to produce the data into external kafka topic." + pConnectionDtl.data;
                                                _PrintInfo(errorStr, objLogInfo);
                                            } else {
                                                topicName = topicName + '_SUCCESS';
                                            }
                                            _PrintInfo('IS_TENANT_MULTI_THREADED - ' + objLogInfo.IS_TENANT_MULTI_THREADED, objLogInfo);
                                            _PrintInfo('Topic Name - ' + topicName, objLogInfo);


                                            data.status = kakfaProduceStatus;
                                            data.modified_date = reqDateFormatter.GetCurrentDate(headers);
                                            data.comments = errorStr;
                                            data.sessInfo = MessageObj.sessInfo
                                            SendToKafkaReqObj.objLogInfo = objLogInfo;
                                            SendToKafkaReqObj.headers = headers;
                                            SendToKafkaReqObj.kafkTopicName = topicName;
                                            SendToKafkaReqObj.commProcessMessageData = { DATA: data, ROUTINGKEY: routingKey, LOG_INFO: objLogInfo.LOG_INFO_FROM_DATA };
                                            reqThreadHelper.SendToKafka(SendToKafkaReqObj, function (callbackInfo) {
                                                _PrintInfo('Data produced to topic | ' + topicName);
                                            });
                                        } catch (error) {
                                            console.log(error)
                                            topicData.error = error.stack
                                            await dlqInsert(topicData)
                                        }

                                    })
                                } else {
                                    var cond = {};
                                    cond.setup_code = SetupCategory;
                                    cond.TenatId = MessageObj.sessInfo.TENANT_ID;
                                    reqsvchelper.GetSetupJson(pClientClt, cond, objLogInfo, async function (res) {
                                        if (res.Status == 'SUCCESS') {
                                            _PrintInfo('Got the setup json value');
                                            if (pClientClt.DBConn.DBType == 'pg') {
                                                var encdata = res.Data[0].setup_json
                                                var DecryptedSetupJson = await reqFXDBInstance.GetDecryptedData(pClientClt, encdata, objLogInfo);
                                                res.Data[0]['setup_json'] = DecryptedSetupJson;
                                                aftergetsetupJson(objLogInfo, headers, res.Data, TemplateCode, arrRows);
                                            } else {
                                                aftergetsetupJson(objLogInfo, headers, res.Data, TemplateCode, arrRows);
                                            }

                                        } else {
                                            sendmessagecallback();
                                        }
                                    });
                                }
                            } else {
                                _PrintInfo('Get the config setup from tenant setup for | ' + SetupCategory);
                                reqFXDBInstance.GetTableFromFXDB(pClientClt, 'tenant_setup', ['setup_json'], {
                                    'CLIENT_ID': MessageObj.sessInfo.CLIENT_ID,
                                    'TENANT_ID': MessageObj.sessInfo.TENANT_ID || '0',
                                    'CATEGORY': SetupCategory
                                }, objLogInfo, async function CallbackGetTableFromFXDB(pError, pResult) {
                                    if (pError) {
                                        topicData.error = pError.stack
                                        await dlqInsert(topicData)
                                    } else {
                                        if (pClientClt.DBConn.DBType == 'pg' && SetupCategory == "MAIL_SETUP") {
                                            var encdata = pResult.rows[0]['setup_json']
                                            var DecryptedSetupJson = await reqFXDBInstance.GetDecryptedData(pClientClt, encdata, objLogInfo);
                                            pResult.rows[0]['setup_json'] = DecryptedSetupJson;
                                            aftergetsetupJson(objLogInfo, headers, pResult.rows, TemplateCode, arrRows);
                                        } else {
                                            aftergetsetupJson(objLogInfo, headers, pResult.rows, TemplateCode, arrRows);
                                        }
                                    }
                                });
                            }
                        } catch (error) {
                            topicData.error = error.stack
                            await dlqInsert(topicData)
                        }

                    });



                    async function aftergetsetupJson(objLogInfo, headers, pResult, TemplateCode, rows) {
                        try {
                            if (pResult != undefined && pResult.length > 0) {
                                _PrintInfo('Tenant setup available for category - ' + pResult[0].category, objLogInfo);

                                var strCommType = 'MAIL';
                                // Assign communcation config from tenant setup
                                var strCommSetup = JSON.parse(pResult[0]['setup_json']);
                                if (pResult[0].category == 'SMS_SETUP') {
                                    strCommType = 'SMS';
                                }
                                reqAsync.forEachOfSeries(rows, function (row, idx, pCallback) {
                                    var ObjMessage = {};
                                    _PrintInfo('Communication Type is ' + strCommType);
                                    if (strCommType == "MAIL") {
                                        getstaticatmt(objLogInfo, headers, TemplateCode).then(function (atmtRes) {
                                            var messageobj = JSON.parse(row.message);
                                            getDynamicatmt(objLogInfo, headers, messageobj, atmtRes).then(async function (FullatmtRes) {
                                                try {
                                                    ObjMessage.Subject = messageobj.Subject;
                                                    ObjMessage.Body = messageobj.Message;
                                                    ObjMessage.ATTACHMENTs = FullatmtRes;
                                                    ObjMessage.IsBodyHtml = true;
                                                    ObjMessage.ServerName = strCommSetup.MAIL.SERVERNAME;
                                                    ObjMessage.PortNo = strCommSetup.MAIL.PORTNO;
                                                    ObjMessage.EMailID = strCommSetup.MAIL.EMAILID;
                                                    ObjMessage.Pwd = strCommSetup.MAIL.PASSWORD;
                                                    ObjMessage.To = messageobj.Address.To || '';
                                                    ObjMessage.Cc = messageobj.Address.Cc || '';
                                                    ObjMessage.Bcc = messageobj.Address.Bcc || '';
                                                    ObjMessage.ReplyTo = messageobj.Address.ReplyTo || '';

                                                    if (messageobj && messageobj.sessInfo.ISARCHIVAL && messageobj.sessInfo.ISARCHIVAL == 'Y') {
                                                        ObjMessage.Subject = ObjMessage.Subject.replace('${PROCESS}', messageobj.sessInfo.ARPROCESS.toLowerCase())
                                                        ObjMessage.Subject = ObjMessage.Subject.replace('${A_ID}', messageobj.sessInfo.AR_ID)
                                                        ObjMessage.Body = ObjMessage.Body.replace('${A_ID}', messageobj.sessInfo.AR_ID);
                                                        ObjMessage.Body = ObjMessage.Body.replace('${PROCESS}', messageobj.sessInfo.ARPROCESS.toLowerCase());
                                                    }

                                                    var att = ObjMessage.ATTACHMENTs;
                                                    if (att != undefined && att != null) {
                                                        if (att.length > 0) {
                                                            var arrAtt = [];
                                                            for (var i = 0; i < att.length; i++) {
                                                                var objAtt = {};
                                                                objAtt[att[i].STATIC_ATTACHMENT_NAME] = att[i].STATIC_ATTACHMENT;
                                                                arrAtt.push(objAtt);
                                                            }
                                                            ObjMessage.Attachments = arrAtt;
                                                        }
                                                    }
                                                    _PrintInfo('Mail sending in progress');
                                                    ObjMessage.comm_process_msg_log = row;
                                                    ObjMessage.headers = headers;
                                                    reqSMTP.SendMail(ObjMessage, objLogInfo, async function callbackSendMail(pStatus) {
                                                        try {
                                                            //Update the status Success or Failure for Mail in comm_process_message table
                                                            var SendToKafkaReqObj = {};
                                                            var topicName = 'FX_COMM_PROCESS_MSG';
                                                            var routingKey = objLogInfo.ROUTINGKEY;
                                                            if (pStatus.Status != "SUCCESS") {
                                                                pStatus.Status = 'FAILED';
                                                                topicName = topicName + '_FAILURE';
                                                            } else {
                                                                topicName = topicName + '_SUCCESS';
                                                            }
                                                            // if (objLogInfo.IS_TENANT_MULTI_THREADED) {
                                                            //     topicName = topicName + '_' + routingKey;
                                                            //     topicName = topicName.replace(/~/g, '_').toUpperCase(); // If Replace is Not Done then It will not create a Kfka Topic
                                                            // }
                                                            _PrintInfo('IS_TENANT_MULTI_THREADED - ' + objLogInfo.IS_TENANT_MULTI_THREADED, objLogInfo);
                                                            _PrintInfo('Topic Name - ' + topicName, objLogInfo);
                                                            var errorStr = (pStatus && pStatus.Error) ? JSON.stringify(pStatus.Error) : '';
                                                            row.status = pStatus.Status;
                                                            row.modified_date = reqDateFormatter.GetCurrentDate(headers);
                                                            row.comments = errorStr;
                                                            SendToKafkaReqObj.objLogInfo = objLogInfo;
                                                            SendToKafkaReqObj.headers = headers;
                                                            SendToKafkaReqObj.kafkTopicName = topicName;
                                                            SendToKafkaReqObj.commProcessMessageData = { DATA: row, ROUTINGKEY: routingKey, LOG_INFO: objLogInfo.LOG_INFO_FROM_DATA };
                                                            reqThreadHelper.SendToKafka(SendToKafkaReqObj, function (callbackInfo) {
                                                                pCallback();
                                                            });

                                                        } catch (error) {
                                                            console.log(error);
                                                            topicData.error = error.stack
                                                            await dlqInsert(topicData)
                                                        }
                                                    });
                                                } catch (error) {
                                                    console.log(error);
                                                    topicData.error = error.stack
                                                    await dlqInsert(topicData)
                                                }
                                            }).catch(async (error) => {
                                                topicData.error = error.stack
                                                await dlqInsert(topicData)
                                                console.log(error);
                                            });
                                        }).catch(async (error) => {
                                            console.log(error);
                                            topicData.error = error.stack
                                            await dlqInsert(topicData)
                                        });
                                    } else if (strCommType == "SMS") {
                                        _PrintInfo('Communication type is SMS', objLogInfo);
                                        //Prepare the Object for send the SMS Properties
                                        var messageobj = JSON.parse(row.message);
                                        ObjMessage.URL = strCommSetup[strCommType].URL;
                                        ObjMessage.To = messageobj.To;
                                        ObjMessage.Message = messageobj.Message;
                                        reqSMSAPI.SendSMS(ObjMessage, objLogInfo, async function callbacksendsms(pStatus) {
                                            try {
                                                //Update the status Success or Failure for Mail in comm_process_message table
                                                var SendToKafkaReqObj = {};
                                                var topicName = 'FX_COMM_PROCESS_MSG';
                                                var routingKey = objLogInfo.ROUTINGKEY;
                                                if (pStatus.Status != "SUCCESS") {
                                                    pStatus.Status = 'FAILED';
                                                    topicName = topicName + '_FAILURE';
                                                } else {
                                                    topicName = topicName + '_SUCCESS';
                                                }
                                                if (objLogInfo.IS_TENANT_MULTI_THREADED) {
                                                    topicName = topicName + '_' + routingKey;
                                                    topicName = topicName.replace(/~/g, '_').toUpperCase(); // If Replace is Not Done then It will not create a Kfka Topic
                                                }
                                                _PrintInfo('IS_TENANT_MULTI_THREADED - ' + objLogInfo.IS_TENANT_MULTI_THREADED, objLogInfo);
                                                _PrintInfo('Topic Name - ' + topicName, objLogInfo);
                                                var errorStr = (pStatus && pStatus.Error) ? JSON.stringify(pStatus.Error) : '';
                                                row.status = pStatus.Status;
                                                row.modified_date = reqDateFormatter.GetCurrentDate(headers);
                                                row.comments = errorStr;
                                                SendToKafkaReqObj.objLogInfo = objLogInfo;
                                                SendToKafkaReqObj.headers = headers;
                                                SendToKafkaReqObj.kafkTopicName = topicName;
                                                SendToKafkaReqObj.commProcessMessageData = { DATA: row, ROUTINGKEY: routingKey, LOG_INFO: objLogInfo.LOG_INFO_FROM_DATA };
                                                reqThreadHelper.SendToKafka(SendToKafkaReqObj, function (callbackInfo) {
                                                    pCallback();
                                                });
                                            } catch (error) {
                                                console.log(error);
                                                topicData.error = error.stack
                                                await dlqInsert(topicData)
                                            }
                                        });
                                    }
                                }, async function (error) {
                                    if (error) {
                                        _PrintInfo('async error occured  ' + error, objLogInfo);
                                        topicData.error = error.stack
                                        await dlqInsert(topicData)
                                    } else {
                                        reqInstanceHelper.DestroyConn(pConsumerName, objLogInfo, function () { });
                                        return;
                                    }
                                });
                            } else {
                                _PrintInfo(' Setup not availbale ', objLogInfo);
                            }

                        } catch (error) {
                            _PrintInfo('Exception occured  ' + error, objLogInfo);
                            topicData.error = error.stack
                            await dlqInsert(topicData)
                        }
                    }

                    function getstaticatmt(objLogInfo, headers, pTemplateCode) {
                        return new Promise((resolve, reject) => {
                            try {
                                _PrintInfo('Check and get the static attachments');
                                reqFXDBInstance.GetFXDBConnection(headers, 'dep_cas', objLogInfo, function CallbackgetFXDBConn(pDepClient) {
                                    try {
                                        var Wherecond = {};
                                        Wherecond.commmt_code = pTemplateCode;
                                        reqFXDBInstance.GetTableFromFXDB(pDepClient, 'COMM_STATIC_ATTACHMENTS', ['static_attachment_name', 'static_attachment'], Wherecond, objLogInfo, function (perr, pResult) {
                                            if (perr) {

                                            } else {
                                                var arrAtt = [];
                                                if (pResult.rows.length) {
                                                    _PrintInfo('Static attachment available');
                                                    for (var i = 0; i < pResult.rows.length; i++) {
                                                        var strB64 = pResult.rows[i]['static_attachment'];
                                                        var byt = reqBase64.toByteArray(strB64);
                                                        _AddAttachments(arrAtt, pResult.rows[i]['static_attachment_name'], byt, 0);
                                                    }
                                                    resolve(arrAtt);
                                                } else {
                                                    _PrintInfo('Static attachment not available');
                                                    resolve(arrAtt);
                                                }
                                            }
                                        });
                                    } catch (error) {
                                        reject(error)
                                    }
                                });
                            } catch (error) {
                                reject(error)
                            }
                        });
                    }

                    function _AddAttachments(pAttachments, pRelativePath, pByteData, pTrnID) {
                        var objAtt = {
                            STATIC_ATTACHMENT_NAME: pRelativePath,
                            STATIC_ATTACHMENT: pByteData,
                            TRN_ID: pTrnID,
                            IsDeleted: false
                        };
                        pAttachments.push(objAtt);
                    }

                    async function getDynamicatmt(objLogInfo, headers, messageobj, atmtRes) {
                        return new Promise(async (resolve, reject) => {
                            try {
                                if (messageobj.ATTACHMENTINFOS.DYNAMICATMT) {
                                    _PrintInfo('Dynamic attachment available');
                                    var trnatmt = messageobj.ATTACHMENTINFOS.DYNAMICATMTDATA;
                                    var dynamictmtarr = [];
                                    for (var i = 0; i < trnatmt.length; i++) {
                                        var dynamictmtobj = {};
                                        dynamictmtobj.RELATIVE_PATH = trnatmt[i].relative_path;
                                        dynamictmtobj.AT_CODE = trnatmt[i].at_code;
                                        dynamictmtobj.ORIGINAL_FILE_NAME = trnatmt[i].original_file_name;
                                        dynamictmtobj.TRN_ID = trnatmt[i].trn_id;
                                        dynamictmtarr.push(dynamictmtobj);
                                    }

                                    reqFXDBInstance.GetFXDBConnection(headers, 'res_cas', objLogInfo, async function (resSession) {
                                        try {
                                            reqAsync.forEachOfSeries(dynamictmtarr, function (dynamicdataobj, idx, pCallback) {
                                                getAtmtfromrescas(resSession, dynamicdataobj, objLogInfo, function (bytedata) {
                                                    if (bytedata) {
                                                        _AddAttachments(atmtRes, dynamicdataobj['ORIGINAL_FILE_NAME'], bytedata, dynamicdataobj['TRN_ID']);
                                                        pCallback();
                                                    }
                                                });
                                            }, function (error) {
                                                if (error) {
                                                    reject(error);
                                                } else {
                                                    _PrintInfo('Dyncamic atmt callback called');
                                                    resolve(atmtRes);
                                                }
                                            });
                                        } catch (error) {
                                            topicData.error = error.stack
                                            await dlqInsert(topicData)
                                        }

                                    });
                                }
                                if (messageobj.ATTACHMENTINFOS.ISCOMMATMT && messageobj.ATTACHMENTINFOS.COMATMTDATA.length) {
                                    reqFXDBInstance.GetFXDBConnection(headers, 'res_cas', objLogInfo, function (resSession) {
                                        var whereObj = {
                                            atmt_name: messageobj.ATTACHMENTINFOS.COMATMTDATA[0].FILE_NAME
                                        }

                                        if (messageobj.ATTACHMENTINFOS.COMATMTDATA[0].TRN_ID) {
                                            whereObj.trn_id = messageobj.ATTACHMENTINFOS.COMATMTDATA[0].TRN_ID
                                        }
                                        if (!whereObj.trn_id) {
                                            var tranData = messageobj.sessInfo && messageobj.sessInfo.TRAN_DATA || [];
                                            if (tranData.length && tranData[0].TRN_ID) {
                                                whereObj.trn_id = tranData.length && tranData[0].TRN_ID;
                                            }
                                        }
                                        reqFXDBInstance.GetTableFromFXDB(resSession, 'COMM_PROCESS_ATMT', [], whereObj, objLogInfo, async function (pError, pResult) {
                                            try {
                                                if (pError) {
                                                    topicData.error = pError.stack
                                                    await dlqInsert(topicData)
                                                } else {
                                                    if (pResult.rows.length) {
                                                        var b64Data = pResult.rows[0].atmt_data
                                                        _AddAttachments(atmtRes, pResult.rows[0]['atmt_name'], b64Data, pResult.rows[0]['trn_id']);
                                                        resolve(atmtRes);
                                                    }
                                                }
                                            } catch (error) {
                                                console.log(error)
                                                topicData.error = error.stack
                                                await dlqInsert(topicData)
                                            }


                                        })
                                    })
                                } else {
                                    _PrintInfo('Dynamic atmt not available');
                                    resolve(atmtRes);
                                }
                            } catch (error) {
                                reject(error)
                            }
                        });
                    }
                    // To get attachment from resource cassandra
                    async function getAtmtfromrescas(pResCas, pParams, pLogInfo, pCallback) {
                        _PrintInfo('getAtmtfromrescas function called');
                        try {
                            var pRelativePath = pParams['RELATIVE_PATH'] ? pParams['RELATIVE_PATH'] : '';
                            var pATCode = pParams['AT_CODE'];
                            reqFXDBInstance.GetTableFromFXDB(pResCas, 'TRNA_DATA', ['byte_data', 'text_data'], {
                                RELATIVE_PATH: pRelativePath
                            }, pLogInfo, async function callbackGetTableFromFXDB(pError, pResult) {
                                var byt = null;
                                if (pError) {
                                    _PrintError(pLogInfo, 'Error on executing query as TRAN_DATA in resource cassandra', 'ERR-COM-20047', pError);
                                    topicData.error = pError.stack
                                    await dlqInsert(topicData)
                                    pCallback(null);
                                } else if (pResult) {
                                    if (pATCode.toUpperCase() == 'IMG') {
                                        if (pResult.rows.length > 0 && pResult.rows[0]['text_data'] != null) {
                                            strBase64 = pResult.rows[0]['text_data'];
                                            byt = reqBase64.toByteArray(strBase64);
                                        }
                                    } else {
                                        if (pResult.rows.length > 0 && pResult.rows[0]['byte_data'] != null) {
                                            byt = pResult.rows[0]['byte_data'];
                                        }
                                    }
                                    pCallback(byt);
                                }
                            });
                        } catch (error) {
                            _PrintError(pLogInfo, 'Error on executing query as TRAN_DATA in resource cassandra', 'ERR-COM-20048', error);
                            topicData.error = error.stack
                            await dlqInsert(topicData)
                            pCallback(null);
                        }
                    }



                    function _PrintInfo(pMessage, pLogInfo) {
                        reqInstanceHelper.PrintInfo('commmessagesender', pMessage, pLogInfo);
                    }
                } catch (error) {
                    topicData.error = error.stack
                    await dlqInsert(topicData)
                }
            }
        });




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
        return reqLogWriter.GetLogInfo('COMM_MESSAGE_SENDER_CONSUMER', 'COMM_MESSAGE_SENDER_CONSUMER_PROCESS', 'COMM_MESSAGE_SENDER_CONSUMER_ACTION', logFilePath);
    } catch (error) {
        return {};
    }
}

module.exports = {
    StartConsuming: startConsuming,
    GetObjLogInfo: GetObjLogInfo
};
/******** End of File **********/
