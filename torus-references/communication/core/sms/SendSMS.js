var reqInstanceHelper = require('../../../common/InstanceHelper');
var reqRequest = require('request');


function Sendmsg(mUrl, pLogInfo, pCallback) {
    try {
        _PrintInfo("Sendmsg function called ", pLogInfo);
        var options = {
            uri: mUrl,
            method: 'GET',
            strictSSL: false
        };

        if (mUrl && mUrl.indexOf('microsvc') > -1) {
            options.headers = {
                'Session-Id': pLogInfo.SESSION_ID
            }
        }
        _PrintInfo('Going to call api ', pLogInfo);
        var Response = {}
        reqRequest(options, function (error, response, body) {
            if (error) {
                _PrintInfo('error ' + error, pLogInfo);
                Response.status = 'FAILURE';
                Response.Errorobj = error;
                Response.ErrorCode = 'ERR-COM-20073';
                Response.Errormsg = 'Error Sendmsg function  ';
                pCallback(Response)
            } else {
                _PrintInfo('response ' + JSON.stringify(response), pLogInfo)
                var smsResult = body.split(',');
                if (smsResult[0] == "Status=1") {
                    _PrintInfo("Error While Sending Message due to the Error - " + smsResult[1], pLogInfo);
                    Response.status = 'FAILURE';
                    Response.Errorobj = smsResult[1];
                    Response.ErrorCode = 'ERR-COM-20075';
                    Response.Errormsg = 'Error in Sendmsg function  ';
                } else {
                    _PrintInfo("Sent successfully with id : " + body, pLogInfo);
                    Response.status = 'SUCCESS';
                    Response.body = body;
                }
                pCallback(Response);
            }
        });

    } catch (error) {
        console.log('Exception occured ' + error)
    }
}
function _PrintInfo(pMessage, pLogInfo) {
    reqInstanceHelper.PrintInfo('SendSMS Core funcion', pMessage, pLogInfo);
}


module.exports = {
    Sendmsg: Sendmsg
}