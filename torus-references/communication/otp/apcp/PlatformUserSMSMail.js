/**
  * Description      : Helper file for sending OTP in AP, CP environments
  */

// Require dependencies
var reqSMTPMail = require('../SMTPMail');
var reqLogWriter = require('../../../log/trace/LogWriter');
var objLogInfo = null;

// Prepare mail data to be send
function PltSMSMailPrep(param, callback) {
    try {
        var pUsermail = param.email_id;
        var pMobileno = param.mobile_no;
        var pClienturl = param.client_url;
        var pNeedurlreplace = param.needurlreplace;
        var pUserName = param.user_name;
        var pOTP = param.OTP;
        var pSMStemplate = param.SMS_TEMPLATE;
        var pMAILtemplate = param.MAIL_TEMPLATE;
        var objMsgTemplts = [];
        var objMsgTemplt = {
            "CATEGORY_INFO": [{
                "COMMC_CODE": "",
                "COMMC_CONFIG": [{
                    "CONFIG": [{
                        "TYPE": "",
                        "SMS": [{
                            "URL": ""
                        }]
                    }]
                }]
            }],
            "TEMPLATE_INFO": [{
                "COMMMT_SUBJECT": "",
                "COMMMT_SIGNATURE": "",
                "COMMMT_MESSAGE": ""
            }],
            "CONTACT_INFOs": {
                TOC: ""
            }
        };
        objMsgTemplt.CATEGORY_INFO[0].COMMC_CODE = pSMStemplate.COMMC_CODE;
        objMsgTemplt.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].TYPE = "SMS";
        objMsgTemplt.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].SMS[0].URL = pSMStemplate.SMS_URL;
        objMsgTemplt.TEMPLATE_INFO[0].COMMMT_SIGNATURE = pSMStemplate.COMMMT_SIGNATURE;
        if (pNeedurlreplace = "Y") {
            objMsgTemplt.TEMPLATE_INFO[0].COMMMT_MESSAGE = pSMStemplate.COMMMT_MESSAGE.replace("~URL~", pClienturl);
        } else {
            objMsgTemplt.TEMPLATE_INFO[0].COMMMT_MESSAGE = pSMStemplate.COMMMT_MESSAGE;
        }
        if (pUserName != null && pUserName != "") {
            objMsgTemplt.TEMPLATE_INFO[0].COMMMT_MESSAGE = objMsgTemplt.TEMPLATE_INFO[0].COMMMT_MESSAGE.replace("~USER_NAME~", pUserName);
        }
        if (pOTP != "") {
            objMsgTemplt.TEMPLATE_INFO[0].COMMMT_MESSAGE = objMsgTemplt.TEMPLATE_INFO[0].COMMMT_MESSAGE.replace("~OTP~", pOTP);
        }
        CONTACT_INFO = {};
        var TOC = {
            'ADDRESS_TYPE': "TO",
            'COLUMN_NAME': "to_otp",
            'STATIC_ADDRESS': pSMStemplate.STATIC_ADDRESS.toString()
        };
        objMsgTemplt.CONTACT_INFOs.TOC = TOC;
        objMsgTemplts.push(objMsgTemplt);

        var objMsgTempltMAIL = {
            "CATEGORY_INFO": [{
                "COMMC_CODE": "",
                "COMMC_CONFIG": [{
                    "CONFIG": [{
                        "TYPE": "",
                        "MAIL": [{
                            "EMAILID": "",
                            "PASSWORD": "",
                            "PORTNO": "",
                            "SERVERNAME": ""
                        }]
                    }]
                }]
            }],
            "TEMPLATE_INFO": [{
                "COMMMT_SUBJECT": "",
                "COMMMT_SIGNATURE": "",
                "COMMMT_MESSAGE": ""
            }],
            "CONTACT_INFOs": {
                TOC: ""
            }
        };
        objMsgTempltMAIL.CATEGORY_INFO[0].COMMC_CODE = pMAILtemplate.COMMC_CODE;
        objMsgTempltMAIL.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].TYPE = "MAIL";
        objMsgTempltMAIL.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].MAIL[0].EMAILID = pMAILtemplate.EMAILID;
        objMsgTempltMAIL.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].MAIL[0].PASSWORD = pMAILtemplate.PASSWORD;
        objMsgTempltMAIL.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].MAIL[0].PORTNO = pMAILtemplate.PORTNO;
        objMsgTempltMAIL.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].MAIL[0].SERVERNAME = pMAILtemplate.SERVERNAME;
        objMsgTempltMAIL.TEMPLATE_INFO[0].COMMMT_SIGNATURE = pMAILtemplate.PASSWORD;
        objMsgTempltMAIL.TEMPLATE_INFO[0].COMMMT_SUBJECT = pMAILtemplate.SUBJECT;
        if (pNeedurlreplace = "Y") {
            objMsgTempltMAIL.TEMPLATE_INFO[0].COMMMT_MESSAGE = pMAILtemplate.COMMMT_MESSAGE.toString().replace("~URL~", pClienturl)
        } else {
            objMsgTempltMAIL.TEMPLATE_INFO[0].COMMMT_MESSAGE = pMAILtemplate.COMMMT_MESSAGE.toString();
        }
        if (pUserName != null && pUserName != "") {
            objMsgTempltMAIL.TEMPLATE_INFO[0].COMMMT_MESSAGE = objMsgTempltMAIL.TEMPLATE_INFO[0].COMMMT_MESSAGE.replace("~USER_NAME~", pUserName);
        }
        if (pOTP != "") {
            objMsgTempltMAIL.TEMPLATE_INFO[0].COMMMT_MESSAGE = objMsgTempltMAIL.TEMPLATE_INFO[0].COMMMT_MESSAGE.replace("~OTP~", pOTP);
        }
        var TOCmail = {
            'ADDRESS_TYPE': "TO",
            'COLUMN_NAME': "to_otp",
            'STATIC_ADDRESS': pMAILtemplate.STATIC_ADDRESS.toString()
        };
        objMsgTempltMAIL.CONTACT_INFOs.TOCmail = TOCmail;
        objMsgTemplts.push(objMsgTempltMAIL);
        sub(objMsgTemplts, function callback(objMsgTemp, dt) {
            try {
                reqSMTPMail.SendMail(objMsgTemp, dt, pUsermail, pMobileno,objLogInfo);
            } catch (error) {
                errorHandler(error, "Error in APCP-OTPConsumer-PlatformUserSMSMail file function ")
            }
        });
        if (callback) {
            return callback('SUCCESS');
        }
    } catch (error) {
        errorHandler(error, "Error in APCP-OTPConsumer-PlatformUserSMSMail file function ")
    }
}

function sub(objMsgTemplts, callback) {
    try {
        var count = 0;
        var objMsgTemp;
        for (var i = 0; i < objMsgTemplts.length; i++) {
            count = count + 1;
            objMsgTemp = objMsgTemplts[i];
            if (objMsgTemp.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].TYPE == "MAIL") {
                var dt = {
                    "to_otp": "SESSION:EMAIL"
                };
            }
            if (count == objMsgTemplts.length) {
                return callback(objMsgTemp, dt);
            }
        }
    } catch (error) {
        errorHandler(error, "Error in APCP-OTPConsumer-PlatformUserSMSMail file function ")
    }
}

function errorHandler(error, errcode) {
    console.log(error.stack, errcode);
    reqLogWriter.TraceError(objLogInfo, error, errcode);
}
module.exports = {
    PltSMSMailPrep: PltSMSMailPrep
};
/********* End of File *************/