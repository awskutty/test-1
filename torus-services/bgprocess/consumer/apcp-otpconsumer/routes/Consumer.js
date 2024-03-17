/****
  @Descriptions - To consume APCP_OTP topic for sending otp mail/sms in ap, cp app   
  @Last_Error_Code  :  ERR-APCPOTP-CONSUMER-0010
 ****/

// Require dependencies
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqMailPrep = require('../../../../../torus-references/communication/otp/apcp/PlatformUserSMSMail.js');
var reqkafkaInstance = require('../../../../../torus-references/instance/KafkaInstance');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var logFilePath = 'bgprocess/consumer/apcp-otpconsumer';
var objLogInfo = reqLogWriter.GetLogInfo('APCP_OTP_CONSUMER', 'APCP_OTP_CONSUMER_PROCESS', 'APCP_OTP_CONSUMER_ACTION', logFilePath);
// Start the consumer for topic APCP_OTP
function startConsuming(pConsumerName, pTopic, pConsumer, pKafka) {
    try {
        reqInstanceHelper.PrintInfo(pConsumerName, 'Started consuming', objLogInfo);
        reqLogWriter.EventUpdate(objLogInfo);

        pConsumer.on(pKafka.eventName, function (message) {
            reqkafkaInstance.DoCommit(pKafka, function () {
                message.value = message.value.toString(); // To Convert buffer to String while using RdKafka Npm...
                var strMsg = JSON.parse(message.value);
                if (strMsg) {
                    // Prepare and send mail/sms for consumed message
                    reqMailPrep.PltSMSMailPrep(objLogInfo, strMsg, function (result) {
                    });
                } else {
                    reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-APCPOTP-CONSUMER-0010', 'This is not a Valid Message...', '');
                }
            });
        });

        pConsumer.on('offsetOutOfRange', function (topic) {
            reqInstanceHelper.PrintWarn(pConsumerName, '------------- offsetOutOfRange ------------', objLogInfo);
            topic.maxNum = 2;
            pKafka.Offset.fetch([topic], function (err, offsets) {
                var min = Math.min.apply(null, offsets[topic.topic][topic.partition]);
                pConsumer.setOffset(topic.topic, topic.partition, min);
            });
        });

    } catch (error) {
        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-APCPOTP-CONSUMER-0009', 'Catch Error in startConsuming()...', error);
    }
}

module.exports = {
    StartConsuming: startConsuming
};
/******** End of File **********/