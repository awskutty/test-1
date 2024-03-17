/**
  * Description      : Helper file for sending mail
  */

// Require dependencies
var reqNodeMailer = require("nodemailer");
var reqLogWriter = require('../../log/trace/LogWriter');
var SendmailSMTP = require('../core/mail/SMTPMessage');
var reqInstanceHelper = require('../../common/InstanceHelper');
var objLogInfo = null;
var pConsumerName = 'wp_otp_consumer';


// Do Sending mail
function sendMail(objMsgTemp, dt, userMail, userMobileNo,pObjLogInfo) {
    try {
        if(pObjLogInfo){
            objLogInfo = pObjLogInfo;
        }
        reqInstanceHelper.PrintInfo(pConsumerName, 'Inside sendMail', objLogInfo);
        var pMailMsg = objMsgTemp;
        pMailMsg.To = userMail;
        if (pMailMsg) {
            pMailMsg.IsBodyHtml = true;
            pMailMsg.ServerName = pMailMsg.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].MAIL[0].SERVERNAME;
            pMailMsg.PortNo = pMailMsg.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].MAIL[0].PORTNO;
            pMailMsg.EMailID = pMailMsg.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].MAIL[0].EMAILID; //
            pMailMsg.Pwd = pMailMsg.CATEGORY_INFO[0].COMMC_CONFIG[0].CONFIG[0].MAIL[0].PASSWORD;
            pMailMsg.Subject = pMailMsg.TEMPLATE_INFO[0].COMMMT_SUBJECT;
            pMailMsg.Body = pMailMsg.TEMPLATE_INFO[0].COMMMT_MESSAGE;

            SendmailSMTP.SendMail(pMailMsg, objLogInfo, function (response) {
                if (response.Status == 'SUCCESS') {
                    reqInstanceHelper.PrintInfo(pConsumerName, 'Message sent: ' + response.Status , objLogInfo);
                } else {
                    reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'Error : ' + response.Error);
                }
            })
        }
    } catch (error) {
        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'Error SMTP file function ','errmsg', error);
        // errorHandler(error, "Error SMTP file function ")
    }
}

function MailOptions() {
    var from = '';
    var to = '';
    var cc = '';
    var bcc = '';
    var subject = '';
    var html = '';
    var text = '';
    var replyTo = '';
    var attachments = [];
}

function Attachments() {
    var filename = '';
    var contents = '';

}

function errorHandler(message, errcode) {
    console.log(message, errcode);
    reqLogWriter.TraceError(objLogInfo, message, errcode);
}
module.exports = {
    SendMail: sendMail
};
/********* End of File *************/