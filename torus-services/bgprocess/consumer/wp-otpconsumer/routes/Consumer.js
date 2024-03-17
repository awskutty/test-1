/****
  @Descriptions     :  To consume OTP topic for sending otp mail/sms in wp app
  @Last_Error_Code  :  ERR-WPOTP-CONSUMER-0010
 ****/

// Require dependencies
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqMailPrep = require('../../../../../torus-references/communication/otp/wp/SendMailPrep');
var reqkafkaInstance = require('../../../../../torus-references/instance/KafkaInstance');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var logFilePath = 'bgprocess/consumer/wp-otpconsumer';
var objLogInfo = reqLogWriter.GetLogInfo('WP_OTP_CONSUMER', 'WP_OTP_CONSUMER_PROCESS', 'WP_OTP_CONSUMER_ACTION', logFilePath);

// Start the consumer for topic OTP
async function startConsuming(pConsumerName, pTopic, pConsumer, pKafka) {
    try {
        reqInstanceHelper.PrintInfo(pConsumerName, 'Started consuming', objLogInfo);
        reqLogWriter.EventUpdate(objLogInfo);
        await pConsumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                message.value = message.value.toString(); // To Convert buffer to String while using RdKafka Npm...
                reqInstanceHelper.PrintInfo(pConsumerName, 'Prepare and send mail/sms for consumed message', objLogInfo);
                var strMsg = JSON.parse(message.value);
                if (strMsg) {
                    reqMailPrep.MailPrep(strMsg, objLogInfo, function (result) {
                    });
                } else {
                    reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-WPOTP-CONSUMER-0010', 'This is not a Valid Message...', '');
                }
            }
        })
    } catch (error) {
        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-WPOTP-CONSUMER-0009', 'Catch Error in startConsuming()...', error);
    }
}

module.exports = {
    StartConsuming: startConsuming
};
/******** End of File **********/