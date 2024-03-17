/**
 * Descriptions      : Helper file for sending mail OTP in WP environment
 */

// Require dependencies
var reqLINQ = require('node-linq').LINQ;
var reqSMTPMail = require('../SMTPMail');
var reqSmsAPI = require('./SmsAPI');
var reqLogWriter = require('../../../log/trace/LogWriter');
var reqEncryptionInstance = require('../../../common/crypto/EncryptionInstance');
var reqInstanceHelper = require('../../../common/InstanceHelper');
var reqServiceHelper = require('../../../common/serviceHelper/ServiceHelper');
var reqDateFormater = require('../../../common/dateconverter/DateFormatter');
var reqDBInstance = require('../../../instance/DBInstance');
var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
var reqRedisInstance = require('../../../instance/RedisInstance');
var request = require('request')
const { resolve } = require('path');
const { reject } = require('lodash');
var objLogInfo = null;
var pConsumerName = 'OTP_CONSUMER';
// Global variable declaration
var mDepClient;
var mCltClient;
var NeedCheckDoubleAuthModel = false;

// Preprea mail data to be send
function MailPrep(param, pObjLogInfo, callback) {
  try {
    if (pObjLogInfo) {
      objLogInfo = pObjLogInfo;
    }
    reqDBInstance.GetFXDBConnection(param.headers, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pDepClient) {
      try {
        mDepClient = pDepClient;
        reqDBInstance.GetFXDBConnection(param.headers, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
          try {
            mCltClient = pCltClient;
            var pUsername = param.login_name;
            // param.OTP_MAIL_TEMPLATE = "FRGT_PWD_MAIL_TEMPLATE";
            // param.OTP_SMS_TEMPLATE = "FRGT_PWD_SMS_TEMPLATE";
            var pOTPMailTemplate = param.OTP_MAIL_TEMPLATE;
            var pOTPSMSTemplate = param.OTP_SMS_TEMPLATE;
            var otpttl = param.OTP_TTL
            var msgvalue = param.msgvalue;
            var strResult = '';
            var strOTPSMSTemplate = '';
            var strOTPMAILTemplate = '';
            if (pOTPMailTemplate == 'FRGT_PWD_MAIL_TEMPLATE' || pOTPSMSTemplate == 'FRGT_PWD_SMS_TEMPLATE') {
              strOTPMAILTemplate = pOTPMailTemplate;
              strOTPSMSTemplate = pOTPSMSTemplate;
            } else {
              NeedCheckDoubleAuthModel = true;
              if (param.double_authentication_model == 'SMS') {
                strOTPSMSTemplate = pOTPSMSTemplate;
              } else if (param.double_authentication_model == 'MAIL') {
                strOTPMAILTemplate = pOTPMailTemplate;
              } else if (param.double_authentication_model == 'BOTH') {
                strOTPSMSTemplate = pOTPSMSTemplate;
                strOTPMAILTemplate = pOTPMailTemplate;
              }
            }
            var usermail = '';
            var randomobj = '';
            var userMobileNo = '';
            if (param.email_id != '' || param.email_id != null) {
              usermail = param.email_id;
            }
            if (param.mobile_no != '' || param.mobile_no != null) {
              userMobileNo = param.mobile_no;
            }
            if (msgvalue == 0) {
              msgvalue = Math.floor(Math.random() * 99999999);
            }
            var encmsgvalue = reqEncryptionInstance.EncryptPassword(msgvalue.toString());
            PrepareMsgData(param, strOTPSMSTemplate, strOTPMAILTemplate, msgvalue, pUsername, async function callbackPrepareMsgData(objMsgTempltes) {
              try {
                reqInstanceHelper.PrintInfo(pConsumerName, 'Inside PrepareMsgData', objLogInfo);

                var redisTTLValue = otpttl || 120
                // if (objMsgTempltes && objMsgTempltes.length) {
                //   redisTTLValue = objMsgTempltes[0].objMsgTemplt.TTL
                // } else {
                //   redisTTLValue = objMsgTempltes.TTL
                // }

                var insertrow = [];
                var objRow = new Object();
                objRow.OTP_ID = "OTP~" + param.OTPId;
                objRow.OTP = encmsgvalue;
                objRow.LOGIN_NAME = param.login_name;
                objRow.CREATED_DATE = reqDateFormater.GetTenantCurrentDateTime(param.headers, objLogInfo);
                objRow.TTL = redisTTLValue
                await InsertOTPIntoRedis(objRow, objLogInfo)
                if (objMsgTempltes.IS_APIMETHOD) {
                  reqInstanceHelper.PrintInfo(pConsumerName, 'Sending OTP by using API method', objLogInfo);
                  callback('SUCCESS');
                } else {
                  console.log('objMsgTempltes ' + objMsgTempltes.length)
                  reqInstanceHelper.PrintInfo(pConsumerName, 'Sending OTP by SMTP method', objLogInfo);
                  for (j = 0; j < objMsgTempltes.length; j++) {
                    if (objMsgTempltes[j].objMsgTemplt.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].TYPE == 'MAIL' && strOTPMAILTemplate != '' && strOTPMAILTemplate != '') {
                      var dt = {
                        'to_otp': 'SESSION:EMAIL'
                      };
                      reqInstanceHelper.PrintInfo(pConsumerName, 'OTP TEMPLATE length : ' + objMsgTempltes.length, objLogInfo);
                      try {
                        reqSMTPMail.SendMail(objMsgTempltes[j].objMsgTemplt, dt, usermail, userMobileNo, objLogInfo);

                      } catch (error) {
                        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'errmsg', 'Error in MailPrep() function ', error);
                      }
                    } else {
                      var dt = {
                        'to_otp': 'SESSION:SMS'
                      };
                      reqInstanceHelper.PrintInfo(pConsumerName, 'sending OTP to SMS', objLogInfo);
                      try {
                        reqSmsAPI.SendSMS(objMsgTempltes[j], usermail, userMobileNo, objLogInfo);
                      } catch (error) {
                        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'errmsg', 'Error in MailPrep() function ', error);
                      }
                    }
                  }

                  callback('SUCCESS');
                }
                // }
                // });
              } catch (error) {
                reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'errmsg', 'Error in MailPrep() function ', error);
              }
            });
          } catch (error) {
            reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'errmsg', 'Error while Sending OTP ', error);
          }
        });
      } catch (error) {
        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'errmsg', 'Error while Sending OTP ', error);
      }
    });
  } catch (error) {
    reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'errmsg', 'Error in SendMailPrep-MailPrep() function ', error);
  }
}

// Check for double authentication model mail/sms
function PrepareMsgData(param, pOTPSMSTemp, pOTPMailTemp, pmsgvalue, pUsername, callback) {
  try {
    if (pOTPMailTemp == 'LOGIN_OTP_MAIL_TEMPLATE' || pOTPSMSTemp == 'LOGIN_OTP_SMS_TEMPLATE') {
      reqInstanceHelper.PrintInfo(pConsumerName, 'OTP for double Authentication', objLogInfo);
      PrepareForDoubleAuthModel(param, pOTPSMSTemp, pOTPMailTemp, pmsgvalue, pUsername, callback);
    } else {
      reqInstanceHelper.PrintInfo(pConsumerName, 'OTP for ForGet Password Authentication', objLogInfo);
      PrepareforForgotPwd(param, pOTPSMSTemp, pOTPMailTemp, pmsgvalue, pUsername, callback);
    }
  } catch (error) {
    reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'errmsg', 'Error in SendMailPrep-PrepareMsgData() function ', error);
  }
}

// Query TENANT_SETUP to find message template
function PrepareMsgDataCore(param, cond, pmsgvalue, pUsername, callback) {
  try {
    var dtcommmsgtemp = '';
    var objMsgTemplts = {};
    var authenticationmodel = '';

    // if (pOTPSMSTemp != '' && pOTPMailTemp != '') {

    var arrTemplates = [];

    var condt = {};
    condt.setup_code = cond;
    // Modified by    : UdhayaRajMs 
    // Modified date  : 13-04-2021
    // Modified for   : Get the tenant setup values for requested tenant id

    if (objLogInfo.TENANT_ID == undefined || objLogInfo.TENANT_ID == '0') {
      objLogInfo.TENANT_ID = param.tenant_id;
    }

    var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
    if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
      reqServiceHelper.GetSetupJson(mCltClient, condt, objLogInfo, function (res) {
        if (res.Status == 'SUCCESS') {
          afterGetsetupJson(res.Data);
        } else {
          reqInstanceHelper.PrintError(pConsumerName, objLogInfo, res.ErrorCode, res.ErrorMsg, res.Error);
          callback();
        }
      });
    } else {
      if (param.tenant_id == undefined) {
        param.tenant_id = '0';
      }
      reqDBInstance.GetTableFromFXDB(mCltClient, 'TENANT_SETUP', [], {
        'client_id': param.client_id,
        'tenant_id': param.tenant_id,
        'category': cond
      }, objLogInfo, function callbacktenantsetup(err, res) {
        if (err) {
          reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'errmsg', 'Error in SendMailPrep-GetTableFromFXDB() function ', err.stack);
        } else {
          afterGetsetupJson(res.rows);
        }
      });
    }

    async function afterGetsetupJson(res) {
      reqInstanceHelper.PrintInfo(pConsumerName, 'TENANT_SETUP rows ' + res.length, objLogInfo);
      if (res !== undefined) {

        // Check OTP Sending method 
        var FRGTMAILTMPLT = new reqLINQ(res)
          .Where(function (item) {
            return item.category == 'FRGT_PWD_MAIL_TEMPLATE';
          }).ToArray();


        if (FRGTMAILTMPLT.length) {
          var parsedSetupJson = JSON.parse(FRGTMAILTMPLT[0].setup_json);
          console.log('encmsgvalue ' + pmsgvalue)
          if (parsedSetupJson.URL) {
            // call OTP api  
            var params = new Object();
            params.apiName = parsedSetupJson.URL;
            parsedSetupJson.MESSAGE = parsedSetupJson.MESSAGE.replaceAll('{MESSAGE_VALUE}', pmsgvalue);
            parsedSetupJson.MAIL_TO = param.email_id
            await OTPApiCall(parsedSetupJson);
            parsedSetupJson.IS_APIMETHOD = true
            callback(parsedSetupJson);
          } else {
            // SMTP method 
            fxmethod()
          }
        } else {
          fxmethod()
        }


        async function fxmethod() {
          var orderbyres = new reqLINQ(res)
            .OrderBy(function (item) {
              return item.category;
            }).ToArray();

          var OTPmailsmsTempl = new reqLINQ(orderbyres)
            .Where(function (item) {
              return item.category == 'FRGT_PWD_SMS_TEMPLATE' || item.category == 'FRGT_PWD_MAIL_TEMPLATE' || item.category == 'LOGIN_OTP_MAIL_TEMPLATE' || item.category == 'LOGIN_OTP_SMS_TEMPLATE';
            }).ToArray();
          var OTPmailsmsSetup = new reqLINQ(orderbyres)
            .Where(function (item) {
              return item.category == 'SMS_SETUP' || item.category == 'MAIL_SETUP';
            }).ToArray();
          for (var i in OTPmailsmsTempl) {
            lstComm = OTPmailsmsTempl[i];
            arrTemplates.push(await GetCommDetail(lstComm, pmsgvalue, pUsername, OTPmailsmsSetup.shift(), param));
          }
          callback(arrTemplates);
        }
      }
    };
  } catch (err) {
    reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'errmsg', 'Error while preparing communication message templates ', err.stack);
  }
}


// Prepare query condition for double authentication model
function PrepareForDoubleAuthModel(param, pOTPSMSTemp, pOTPMailTemp, pmsgvalue, pUsername, callback) {
  var dtcommmsgtemp = '';
  var objMsgTemplts = {};
  var authenticationmodel = '';
  try {
    if (param.double_authentication_model != undefined || param.double_authentication_model != '' || param.double_authentication_model != null) {
      authenticationmodel = param.double_authentication_model;
      var cond = [];
      reqInstanceHelper.PrintInfo(pConsumerName, '--------------OTP SEND To ' + authenticationmodel + '-----------', objLogInfo);
      if (authenticationmodel == 'MAIL') {
        cond = [pOTPMailTemp, 'MAIL_SETUP'];
      } else if (authenticationmodel == 'SMS') {
        cond = [pOTPSMSTemp, 'SMS_SETUP'];
      } else if (authenticationmodel == 'BOTH') {
        cond = [pOTPSMSTemp, pOTPMailTemp, 'MAIL_SETUP', 'SMS_SETUP'];
      }
      PrepareMsgDataCore(param, cond, pmsgvalue, pUsername, callback);
    }
  } catch (error) {
    reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'errmsg', 'Error on PrepareForDoubleAuthModel()-preparing communication message templates', error);
  }
}

// Prepare condition for Forgot password
function PrepareforForgotPwd(param, pOTPSMSTemp, pOTPMailTemp, pmsgvalue, pUsername, callback) {
  console.log('OTP will send to ' + param.OTPsend);
  if (param.OTPsend == 'MAIL') {
    var cond = [];
    cond = [pOTPMailTemp, 'MAIL_SETUP'];
  } else if (param.OTPsend == 'SMS') {
    var cond = [];
    cond = [pOTPSMSTemp, 'SMS_SETUP',];
  } else if (param.OTPsend == 'BOTH') {
    var cond = [];
    cond = [pOTPSMSTemp, pOTPMailTemp, 'SMS_SETUP', 'MAIL_SETUP'];
  }

  PrepareMsgDataCore(param, cond, pmsgvalue, pUsername, callback);
}

async function GetCommDetail(lstComm, pmsgvalue, pUsername, pRes, params) {
  try {
    var objMsgTemplt = {
      'CATEGORY_INFO': [{
        'COMMC_CODE': '',
        'COMMC_CONFIG': [{
          'CONFIG': [{
            'TYPE': '',
            'MAIL': [{
              'EMAILID': '',
              'PASSWORD': '',
              'PORTNO': '',
              'SERVERNAME': ''
            }],
            'SMS': [{
              'URL': ''
            }]
          }]
        }]
      }],
      'TEMPLATE_INFO': [{
        'COMMMT_SUBJECT': '',
        'COMMMT_SIGNATURE': '',
        'COMMMT_MESSAGE': ''
      }],
      'CONTACT_INFOs': {
        TOC: ''
      }
    };
    var objMsgTemplts = {
      'objMsgTemplt': ''
    };
    var strcategory = pRes.category;
    if (strcategory == 'MAIL_SETUP') {
      reqInstanceHelper.PrintInfo(pConsumerName, 'Getting MAIL_SETUP setup', objLogInfo);
      var DecryptedSetupJson = await reqDBInstance.GetDecryptedData(mCltClient, pRes.setup_json, objLogInfo);
      var mailsetup = JSON.parse(DecryptedSetupJson);
      objMsgTemplt.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].TYPE = 'MAIL';
      objMsgTemplt.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].MAIL[0] = mailsetup.MAIL;
      objMsgTemplt.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].MAIL[0].EMAILID = mailsetup.MAIL.EMAILID;
      objMsgTemplt.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].MAIL[0].PASSWORD = mailsetup.MAIL.PASSWORD;
      objMsgTemplt.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].MAIL[0].PORTNO = mailsetup.MAIL.PORTNO;
      objMsgTemplt.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].MAIL[0].SERVERNAME = mailsetup.MAIL.SERVERNAME;
    } else {
      reqInstanceHelper.PrintInfo(pConsumerName, 'Getting SMS_SETUP setup', objLogInfo);
      var DecryptedSetupJson = await reqDBInstance.GetDecryptedData(mCltClient, pRes.setup_json, objLogInfo);
      var smssetup = JSON.parse(DecryptedSetupJson);

      // var smssetup = JSON.parse(pRes.setup_json);
      objMsgTemplt.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].TYPE = 'SMS';
      objMsgTemplt.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].SMS[0].URL = smssetup.SMS.URL;
    }
    var temp = JSON.parse(lstComm.setup_json);
    objMsgTemplt.TEMPLATE_INFO[0].COMMMT_SUBJECT = temp.SUBJECT;
    temp.MESSAGE = temp.MESSAGE.replace(new RegExp('{MESSAGE_VALUE}', 'g'), pmsgvalue); // replace all occerence
    temp.MESSAGE = temp.MESSAGE.replace(new RegExp('{USER_NAME}', 'g'), pUsername); // replace all occerence
    if (params) {
      var usercolomns = Object.keys(params);
      for (var i = 0; i < usercolomns.length; i++) {
        var currCol = usercolomns[i];
        temp.MESSAGE = temp.MESSAGE.replace(new RegExp('{' + currCol.toUpperCase() + '}', 'g'), params[currCol.toLowerCase()]); // replace all occerence
      }
    }
    objMsgTemplt.TEMPLATE_INFO[0].COMMMT_MESSAGE = temp.MESSAGE;
    objMsgTemplt.TTL = temp.TTL
    // var TOC = {
    //   'ADDRESS_TYPE': 'TO',
    //   'COLUMN_NAME': 'to_otp',
    //   'STATIC_ADDRESS': 'registration@digitizeindia.gov.in'
    // };
    // objMsgTemplt.CONTACT_INFOs.TOC = TOC;
    objMsgTemplts.objMsgTemplt = objMsgTemplt;
    return objMsgTemplts;
  } catch (error) {
    reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'errmsg', 'Error in SendMailPrep-GetCommDetail() function', error);
  }
}

async function InsertOTPIntoRedis(pOTPData, objLogInfo) {
  try {
    return new Promise((resolve, reject) => {
      reqInstanceHelper.PrintInfo(pConsumerName, 'InsertOTPIntoRedis function executing', objLogInfo);
      reqRedisInstance.GetRedisConnectionwithIndex('3', async function (error, redisSession) {
        if (error) {
          reject(error)
        } else {
          reqInstanceHelper.PrintInfo(pConsumerName, 'Got redis connection', objLogInfo);
          var rvalue = { "OTP": pOTPData.OTP }
          var rKey = pOTPData.OTP_ID;
          var TTL = pOTPData.TTL || 120
          await reqRedisInstance.RedisInsertWithTTL(redisSession, rKey, rvalue, TTL);
          reqInstanceHelper.PrintInfo(pConsumerName, 'OTP inserted into redis with TTL', objLogInfo);
          resolve()
        }
      })
    })
  } catch (error) {
    reject(error)
  }
}

// otp send to api call method 
async function OTPApiCall(pParams) {
  try {
    return new Promise((resolve, reject) => {
      var RedisURLKey = "NGINX_HAPROXY_URL";
      var URLPrecedence = "";
      // get the nginx url in redis
      reqRedisInstance.GetRedisConnection(async function (error, clientR) {
        if (error) {
          reqInstanceHelper.SendResponse('Achival Process', appResponse, '', objLogInfo, 'ERR-MIN-50603', 'ERROR IN GET REDIS CONNECTION ', error, '', '');
        } else {
          var urldtlFromRedis = await clientR.get(RedisURLKey)
          var URLPrecedence = JSON.parse(urldtlFromRedis)["url"];
          var PARAMS = {
            PARAMS: {
              MAIL_TO: pParams.MAIL_TO,
              MESSAGE: pParams.MESSAGE,
              SUBJECT: pParams.SUBJECT
            },
            PROCESS_INFO: {
              "MODULE": "Administrator",
              "MENU_GROUP": "Administrator",
              "MENU_ITEM": "Administrator",
              "PROCESS_NAME": "Password"
            }
          }
          var reqOptions = {
            method: 'POST',
            json: true,
            body: PARAMS,
            url: URLPrecedence + '/' + pParams.URL
          };
          request(reqOptions, function (error, response, body) {
            if (error) {
              reject(error)
            } else {
              resolve()
            }
          });
        }
      })
    })
  } catch (error) {

  }
}

function errorHandler(message, errcode) {
  console.log(message, errcode);
  // reqLogWriter.TraceError(objLogInfo, message, errcode);
}
module.exports = {
  MailPrep: MailPrep
};
/********* End of File *************/
