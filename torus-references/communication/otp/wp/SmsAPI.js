/**
  * Description      : Helper file for sending sms OTP in WP environment
  */

// Require dependencies
var reqLogWriter = require('../../../log/trace/LogWriter');
var reqSendSMS = require('../../../communication/core/sms/SendSMS');
var objLogInfo = null;
var reqInstanceHelper = require('../../../common/InstanceHelper');
// Get the communication template info
function SendSms(objMsgTemp, userMail, userMobileNo,pObjLogInfo) {
    try {
        if(pObjLogInfo){
            objLogInfo = pObjLogInfo;
        }
        if (userMobileNo != '') {
            reqInstanceHelper.PrintInfo('SMS API', 'Inside SendSms', objLogInfo);
            var strUrl = objMsgTemp.objMsgTemplt.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].SMS[0].URL
            var strMobileNo = userMobileNo
            var strMessage = objMsgTemp.objMsgTemplt.TEMPLATE_INFO[0].COMMMT_MESSAGE
            strUrl = strUrl.replace('<MOBILENO>', userMobileNo)
            strUrl = strUrl.replace('<MESSAGE>', strMessage)
            reqSendSMS.Sendmsg(strUrl, objLogInfo, function (response) {
            })
        } else{
            errorHandler('Mobile Number is empty','errcode')
        }
    } catch (ex) {
        errorHandler('Error' + ex,'errcode')
    }
}

function errorHandler(message, errcode) {
    reqLogWriter.TraceError(objLogInfo, message, errcode);
}
module.exports = {
    SendSMS: SendSms
}
/********* End of File *************/