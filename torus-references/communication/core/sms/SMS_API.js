/**
Api_Name        : /SendMessage
Description     : To send the sms message via third party API
Last ErrorCode  : ERR-COM-20078
*/

// Require dependencies
var reqInstanceHelper = require('../../../common/InstanceHelper');
var reqSendSMS = require('../../../communication/core/sms/SendSMS');

// To send the SMS through AMS API
function SendSMS(pSmsMsg, pLogInfo, pCallback) {
    var mUrl = ''
    var mSmsMsg = ''
    var mToAddr = ''
    try {
        if (pSmsMsg) {

            mUrl = pSmsMsg.URL
            mSmsMsg = pSmsMsg.Message
            mToAddr = pSmsMsg.To

            mUrl = mUrl.replace("<MOBILENO>", mToAddr)
            mUrl = mUrl.replace("<MESSAGE>", mSmsMsg)

            _PrintInfo("Http request to URL: " + mUrl, pLogInfo)

            reqSendSMS.Sendmsg(mUrl, pLogInfo, function (response) {
                try {
                    if (response.status == 'SUCCESS') {
                        return _PrepareAndSendCallback('SUCCESS', null, '', '', null, 'Sent successfully with id: ' + response.body, pCallback)
                    } else {
                        return _PrepareAndSendCallback('FAILURE', null, response.ErrorCode, response.Errormsg, response.Errorobj, null, pCallback)
                    }
                } catch (error) {
                    return _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20076', 'Error on SendSMS()', error, '', pCallback)
                }
            })
        } else {
            return _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20075', 'Error on SendSMS()', error, 'SMS message object not found', pCallback)
        }
    } catch (error) {
        return _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20076', 'Error on SendSMS()', error, '', pCallback)
    }
}

// To print the error message
function _PrintError(pLogInfo, pMessage, pErrorCode, pError) {
    reqInstanceHelper.PrintError('SMS_API', pMessage, pErrorCode, pLogInfo);
}

// To Print the information message
function _PrintInfo(pMessage, pLogInfo) {
    reqInstanceHelper.PrintInfo('SMS_API', pMessage, pLogInfo);
}

// Prepare callback object
function _PrepareAndSendCallback(pStatus, pData, pErrorCode, pErrMsg, pError, pWarning, pCallback) {
    pCallbackObj = {
        Status: pStatus,
        Data: pData,
        ErrorCode: pErrorCode,
        ErrorMsg: pErrMsg,
        Error: pError,
        Warning: pWarning
    }
    return pCallback(pCallbackObj)
}

module.exports = {
    SendSMS: SendSMS
}