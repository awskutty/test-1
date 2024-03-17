/****
  @Descriptions     :  To consume SAVE_TRAN topic for sending otp mail/sms in ap, cp app 
  @Last_Error_Code  :  ERR-SAVETRAN-CONSUMER-0011
 ****/

// Require dependencies
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqkafkaInstance = require('../../../../../torus-references/instance/KafkaInstance');
var reqSaveTranToSolrHelper = require('../../../../../torus-references/common/solrhelper/savetran/SaveTranToSolrHelper');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var logFilePath = 'bgprocess/consumer/savetranconsumer';
var objLogInfo = reqLogWriter.GetLogInfo('SAVE_TRAN_CONSUMER', 'SAVE_TRAN_CONSUMER_PROCESS', 'SAVE_TRAN_CONSUMER_ACTION', logFilePath);
var pConsumerName = 'SaveTranConsumer';
// Start the consumer for topic SAVE_TRAN
function startConsuming(pConsumer, pTopic, pConsumer, pKafka) {
    try {
        reqInstanceHelper.PrintInfo(pConsumerName, 'Started consuming', objLogInfo);
        reqLogWriter.EventUpdate(objLogInfo);
        function readMessage(message) {
            try {
                reqInstanceHelper.PrintInfo(pConsumerName, 'Start', objLogInfo);
                reqInstanceHelper.PrintInfo(pConsumerName, 'Message Received', objLogInfo);
                var kafka = require('kafka-node');
                var offset = new kafka.Offset(pConsumer.client);
                offset.fetch([
                    { topic: pTopic, partition: 0, time: Date.now(), maxNum: 1 }
                ], function (error, data) {
                    try {
                        if (error) {
                            reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-SAVETRAN-CONSUMER-0001', 'Error in Fetching Messages from Kafka...', error);
                        } else {
                            var currentOffset = data[pTopic][0][0];
                            reqInstanceHelper.PrintInfo(pConsumerName, currentOffset + ' is Current Offset', objLogInfo);
                            var json = JSON.parse(message.value);

                            // Commit the kafka after processing the message successfully
                            function doCommit(result) {
                                try {
                                    if (result == 'SUCCESS') {
                                        pConsumer.commit(function (error, result) {
                                            try {
                                                if (error) {
                                                    reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-SAVETRAN-CONSUMER-0002', 'Error While Commiting Offset Messages from Kafka...', error);
                                                } else {
                                                    reqInstanceHelper.PrintInfo(pConsumerName, 'Success Calback', objLogInfo);
                                                    reqInstanceHelper.PrintInfo(pConsumerName, currentOffset + ' Offset Commiting', objLogInfo);
                                                    reqInstanceHelper.PrintInfo(pConsumerName, 'End', objLogInfo);
                                                    reqLogWriter.EventUpdate(objLogInfo);
                                                }
                                            } catch (error) {
                                                reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-SAVETRAN-CONSUMER-0003', 'Catch Error While Commiting Offset Messages from Kafka...', error);
                                            }
                                        });
                                    } else {
                                        reqInstanceHelper.PrintInfo(pConsumerName, 'End', objLogInfo);
                                        reqLogWriter.EventUpdate(objLogInfo);
                                    }
                                } catch (error) {
                                    reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-SAVETRAN-CONSUMER-0004', 'Catch Error in doCommit()...', error);
                                }
                            }
                            doConsumerProccess();
                            function doConsumerProccess() {
                                try {
                                    onKafkaGotMsg(message, function (result) {
                                        // doCommit('SUCCESS'); // Result Will be SUCCESS or FAILURE...
                                        doCommit(result); // Result Will be SUCCESS or FAILURE...
                                    });
                                        // doCommit('SUCCESS'); // Result Will be SUCCESS or FAILURE...
                                } catch (error) {
                                    reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-SAVETRAN-CONSUMER-0005', 'Catch Error in doConsumerProccess()...', error);
                                    doCommit('FAILURE');
                                }
                            }
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-SAVETRAN-CONSUMER-0006', 'Catch Error in Kafka Message Fetching Function Callback...', error);
                    }
                });
            }
            catch (error) {
                reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-SAVETRAN-CONSUMER-0007', 'Catch Error in readMessage()...', error);
            }
        }
        pConsumer.on('message', readMessage);

        pConsumer.on('error', function (error) {
            reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-SAVETRAN-CONSUMER-0008', 'Error in pConsumer.on("error") Event...', error);
            if (error.stack && error.stack.indexOf('TopicsNotExistError') >= 0) {
                reqkafkaInstance.CreateTopic(pKafka, pTopic, function Callback() {
                    startConsuming();
                });
            }
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
        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-SAVETRAN-CONSUMER-0009', 'Catch Error in startConsuming()...', error);
    }
}

// this will hit, when consumer got message
function onKafkaGotMsg(msg, pCallback) {
    try {
        if (msg) {
            var json = JSON.parse(msg.value);
            if (json) {
                reqSaveTranToSolrHelper.TranIndex(json, objLogInfo, function (solrResult) {
                    try {
                        return pCallback(solrResult);
                    } catch (error) {
                        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-SAVETRAN-CONSUMER-0010', 'Catch Error in onKafkaGotMsg - TranIndex() Callback...', error);
                        return pCallback('FAILURE');
                    }
                });
            }
        }
    } catch (error) {
        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-SAVETRAN-CONSUMER-0011', 'Catch Error in onKafkaGotMsg()...', error);
        return pCallback('FAILURE');
    }
}

module.exports = {
    StartConsuming: startConsuming
};
/******** End of File **********/