/*
  @Decsription: To create and maintain KafkaInstance for producers and consumers
  @Last Error Code : 'ERR-KAF-234044'
*/

// Require dependencies 
// var reqKafka = require('kafka-node');
const { Kafka } = require('kafkajs');
var fs = require('fs');
var reqInstanceHelper = require('../common/InstanceHelper');
var reqDBInstance = require('../instance/DBInstance');
var mKafkaConfig = [];
var arrConnectedServers = [];
var mKafkaSessionValues = {};
var connString = 'KAFKA_CONFIG';
var defaultRoutingKey = 'clt-0~app-0~tnt-0~env-0';

var serviceName = 'KafkaInstance';
var objLogInfo = null;
var retryKafka = false;


var kakfaDetails = {
    "SERVER": "<>",
    "CONSUMER_PORT": "2181",
    "PRODUCER_PORT": "2181",
    "KAFKA_SERVER_PORT": "9092",
    "KAFKA_CONNECT_SERVER_PORT": "8083",
    "TRACE_TOPIC": "TRACE_LOG",
    "TRAN_DATA_TOPIC": "TRAN_DATA",
    "CONTENT_DATA_TOPIC": "CONTENT_DATA",
    "OTP_TOPIC": "OTP",
    "CONSUMER_OPTIONS": {
        "autoCommit": false,
        "fetchMinBytes": 1,
        "fetchMaxBytes": 10000000,
        "fromOffset": true,
        "fromBeginning": false,
        "maxPollIntervalSec": 100
    }
};
// create kafka instance on startup

async function createKafkaInstance(pRedisKey, pVal, isFromConsumerInstance, pCallback) {
    try {
        // Hardcoded values Only for Development
        // pVal = kakfaDetails
        if (pVal) {
            var kafkaConfig = pVal; //JSON.parse(pVal);
            var kafkaIns = {};

            var currentKey = '';
            for (var i = 0; i < arrConnectedServers.length; i++) {
                var item = arrConnectedServers[i];
                if (JSON.stringify(item.conn) == JSON.stringify(kafkaConfig)) {
                    currentKey = item.keyName;
                    break;
                }
            }
            // if (currentKey != '') {
            if (currentKey != '' & !isFromConsumerInstance) {
                kafkaIns = mKafkaSessionValues[currentKey];
                kafkaClientCreated();
            } else {
                // Create kafka Producer
                var Producer;
                var Consumer;
                var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
                var ProducerClient;
                var producer;
                var ConsumerClient;
                var Offset;
                var offset;
                // Create Kafka Consumer Client
                var zk_options = {};
                zk_options.sessionTimeout = 20000;
                zk_options.spinDelay = 1000;
                zk_options.retries = 4;
                var maxFetchBytes = kafkaConfig.CONSUMER_OPTIONS.fetchMaxBytes || 10000000 // 10MB Default;
                // reqInstanceHelper.PrintInfo(serviceName, 'Maximum Message Size Bytes - ' + maxFetchBytes, objLogInfo);

                if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {

                    // Using node-rdkafka NPM
                    // reqInstanceHelper.PrintInfo(serviceName, 'Platform Version - 7.0 and KAFKA_SERVER_PORT - ' + kafkaConfig.KAFKA_SERVER_PORT, objLogInfo);
                    if (!kafkaConfig.KAFKA_SERVER_PORT) {
                        reqInstanceHelper.PrintInfo(serviceName, 'KAFKA_SERVER_PORT is Not Available from the Kafka Config...', objLogInfo);
                    }
                    // var producerglobalConfig = {
                    //     'metadata.broker.list': kafkaConfig.SERVER + ':' + kafkaConfig.KAFKA_SERVER_PORT,
                    //     'message.max.bytes': maxFetchBytes
                    // };
                    // var producerTopicConfig = {
                    //     "acks": "all"
                    // };
                    const kafka = new Kafka({
                        clientId: 'Global',
                        brokers: [`${kafkaConfig.SERVER}:${kafkaConfig.KAFKA_SERVER_PORT}`]
                    })
                    kafkaIns.kafka = kafka
                    producer = kafka.producer();
                    await producer.connect();
                    kafkaIns.isLatestPlatformVersion = true;
                    kafkaIns.kafkaConfig = kafkaConfig;
                    kafkaIns.eventName = 'data';
                    kafkaIns.errorEventName = 'event.error';

                } else {
                    Producer = reqKafka.HighLevelProducer;
                    ProducerClient = new reqKafka.Client(kafkaConfig.SERVER + ':' + kafkaConfig.PRODUCER_PORT);
                    producer = new Producer(ProducerClient);
                    Offset = reqKafka.Offset;
                    ConsumerClient = new reqKafka.Client(kafkaConfig.SERVER + ':' + kafkaConfig.CONSUMER_PORT, 'consumer' + process.pid, zk_options);
                    offset = new Offset(ConsumerClient);
                    kafkaIns.eventName = 'message';
                    kafkaIns.errorEventName = 'error';
                }
                kafkaIns.Producer = producer;
                kafkaIns.ConsumerClient = ConsumerClient;
                kafkaIns.Offset = offset;
                // kafkaConfig.CONSUMER_OPTIONS.fromOffset = '1';
                // kafkaConfig.CONSUMER_OPTIONS.fromOffset = '48';
                mKafkaConfig['consumer_options'] = kafkaConfig.CONSUMER_OPTIONS;
                CheckKafkaInstanceAvail(kafkaIns, function (result) {
                    try {
                        if (result == 'SUCCESS') {
                            pushConnectionToArray(pRedisKey, kafkaConfig);
                            kafkaClientCreated();
                        } else {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234001', 'FAILURE for ' + pRedisKey, '');
                            doConnect(pRedisKey, isFromConsumerInstance, function (resultInfo) {
                                if (resultInfo.status == 'SUCCESS') {
                                    createKafkaInstance(pRedisKey, pVal, isFromConsumerInstance, pCallback);
                                    // return pCallback(result);
                                }
                            });
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234002', 'Error in createKafkaInstance function', error);
                    }
                });
            }

            function kafkaClientCreated() {
                try {
                    mKafkaSessionValues[pRedisKey.toUpperCase()] = kafkaIns;
                    var result = {};
                    result.status = 'SUCCESS';
                    result.sessionCount = Object.keys(mKafkaSessionValues).length;
                    return pCallback(result);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234003', 'Error in createKafkaInstance function', error);
                }
            }
        } else {
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234038', 'Error in createKafkaInstance function', 'kafka config not found');
            return pCallback('kafka config not found');
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234004', 'Error in createKafkaInstance function', error);
    }
}

// add connected server to array
function pushConnectionToArray(pKey, pConn) {
    try {
        var obj = {};
        obj.keyName = pKey;
        obj.conn = pConn;
        arrConnectedServers.push(obj);
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234005', 'Error in pushConnectionToArray function', error);
    }
}

// check kafka is running using producer topic creation
async function CkeckKafkaIsRunning(pKafka, callback) {
    reqInstanceHelper.PrintInfo(serviceName, 'Checking Kafka Server is Running Or Not', objLogInfo);
    var isLatestPlatformVersion = pKafka.isLatestPlatformVersion || false;
    var mProducer = pKafka.Producer
    if (isLatestPlatformVersion) {
        var res = await mProducer.send({
            topic: 'test', messages: [
                { value: 'HelloWorld !' },
            ],
        })
        if (res.length) {
            return callback('SUCCESS');
        }
    } else {
        mProducer.send([{
            topic: 'test',
            partition: 0,
            messages: 'HelloWorld',
        }], function (err, result) {
            if (err) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234043', 'Error While Producing a Data Into a Test Topic', err);
                return callback('FAILURE');
            } else {
                if (callback) {
                    return callback('SUCCESS');
                }
            }
        });
    }
    mProducer.on('error', function (err) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234044', 'Producer Instance Creation Error', err);
        return callback('FAILURE');
    });
}

// create and get kafka consumer by topic and group
function getConsumer(pTopic, pGroupId, pHeaders, callback, pOptionalParam) {
    try {
        var isFromConsumerInstance = true;
        var kafkTopicPartition = 0;
        var maxKafkaMsgCount = null;
        var isLatestPlatformVersion = false;
        var kafkaRetryInterval = 0;
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
            isLatestPlatformVersion = true;
        }
        var kafkaTopicPartitionCount = 1;
        var totalTopicNames = [];
        var totalTopicInfo = [];
        var rdKafkaTopicConfig = {
            'auto.offset.reset': 'earliest'
        };
        if (pOptionalParam) {
            if (pOptionalParam.kafkaTopicPartitionCount) {
                kafkaTopicPartitionCount = pOptionalParam.kafkaTopicPartitionCount;// Param From Newly Added Consumer Services [App.js] file 
            }
            // reqInstanceHelper.PrintInfo(serviceName, 'Kafka Partition Count - ' + kafkaTopicPartitionCount, objLogInfo);
            if (pOptionalParam.listeningPartition) {
                kafkTopicPartition = pOptionalParam.listeningPartition; // Param From Newly Added Consumer Services [App.js] file 
            }
            // reqInstanceHelper.PrintInfo(serviceName, 'Listening Partition - ' + kafkTopicPartition, objLogInfo);
            if (pOptionalParam.maxKafkaMsgCount) {
                maxKafkaMsgCount = pOptionalParam.maxKafkaMsgCount; // Param From Newly Added Consumer Services [App.js] file 
            }
            // reqInstanceHelper.PrintInfo(serviceName, 'Maximum Kafka Message Count - ' + maxKafkaMsgCount, objLogInfo);
            var kafkaTopics = pOptionalParam.kafkaTopics || [];
        }
        if (totalTopicNames.indexOf(pTopic) == -1) {
            totalTopicNames.push(pTopic);
            var topicInfo = {};
            topicInfo.topicName = pTopic;
            topicInfo.totalNoOfPartitions = kafkaTopicPartitionCount;
            totalTopicInfo.push(topicInfo);
        }
        var kafka = null;
        if (!pHeaders) {
            pHeaders = {};
        }
        var serviceParamRedisKey = 'SERVICE_PARAMS';
        // Getting the Service params based on the Service Name from the Redis
        reqInstanceHelper.GetConfig(serviceParamRedisKey, function (serviceParamRedisKeyValue, error) {
            // reqInstanceHelper.PrintInfo(serviceName, 'Redis Key - ' + serviceParamRedisKey + ' Redis Value - ' + serviceParamRedisKeyValue, objLogInfo);
            if (serviceParamRedisKeyValue) {
                try {
                    serviceParamRedisKeyValue = JSON.parse(serviceParamRedisKeyValue)[pOptionalParam.SERVICE_NAME];
                } catch (error) {

                }
            }
            // reqInstanceHelper.PrintInfo(serviceName, 'routingkey ==== ' + pHeaders['routingkey'], objLogInfo);
            reqInstanceHelper.GetRedisKey(connString, pHeaders['routingkey'], function (redisKey) {
                try {
                    // reqInstanceHelper.PrintInfo(serviceName, 'Finding redisKey ==== ' + redisKey, objLogInfo);
                    reqInstanceHelper.IsRedisKeyAvail(redisKey, function (result) {
                        try {
                            if (result) {
                                if (mKafkaSessionValues[redisKey]) {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Kafka key available in memory', objLogInfo);
                                    kafka = mKafkaSessionValues[redisKey];
                                    CkeckKafkaIsRunning(kafka, function (pRes) {
                                        if (pRes == 'SUCCESS') {
                                            var HLConsumer;
                                            var client = kafka.ConsumerClient;
                                            // if (isLatestPlatformVersion) {
                                            //     Consumer = reqKafkaV5_5_0.Consumer;
                                            // } else {
                                            //     Consumer = reqKafka.HighLevelConsumer;
                                            // }
                                            var payloads = [{
                                                topic: pTopic,
                                                partition: kafkTopicPartition
                                            }];


                                            if (kafkaTopics && kafkaTopics.length) {
                                                for (var u = 0; u < kafkaTopics.length; u++) {
                                                    const element = kafkaTopics[u];
                                                    var kafkaTopicObj = {};
                                                    kafkaTopicObj.topic = element;
                                                    if (totalTopicNames.indexOf(element) == -1) {
                                                        totalTopicNames.push(element);
                                                        var topicInfo = {};
                                                        topicInfo.topicName = element;
                                                        topicInfo.totalNoOfPartitions = kafkaTopicPartitionCount;
                                                        totalTopicInfo.push(topicInfo);
                                                    }
                                                    kafkaTopicObj.partition = kafkTopicPartition;
                                                    payloads.push(kafkaTopicObj);
                                                }
                                            }
                                            console.log(JSON.stringify(payloads, null, '\t'));
                                            var jsonOptions = mKafkaConfig['consumer_options'];
                                            var maxPollInterval = jsonOptions.maxPollIntervalSec || 3600;//1 hr
                                            var consumer;
                                            var kafkaConfig;
                                            var serverInfo = kafkaConfig.SERVER + ':' + kafkaConfig.KAFKA_SERVER_PORT;

                                            var rdKafkaConfig = {
                                                'group.id': pGroupId,
                                                'metadata.broker.list': serverInfo,
                                                'enable.auto.commit': jsonOptions['autoCommit'],
                                                'event_cb': true,
                                                'max.poll.interval.ms': (maxPollInterval * 1000) // Converting Into MilliSeconds
                                            };

                                            if (isLatestPlatformVersion) {
                                                var kafkaConfig = kafka.kafkaConfig;
                                                consumer.connect();
                                                kafka.maxKafkaMsgCount = maxKafkaMsgCount;
                                                kafka.SERVICE_PARAMS = serviceParamRedisKeyValue;
                                                kafka.OPTIONAL_PARAMS = pOptionalParam;
                                                consumer.on('ready', function () {
                                                    consumer.subscribe(totalTopicNames);
                                                    if (!maxKafkaMsgCount) {
                                                        consumer.consume();
                                                        if (kafkaRetryInterval) {
                                                            reqInstanceHelper.PrintInfo(serviceName, 'Consumer Connected with the Kafka Server...', objLogInfo);
                                                            consumer.errorCounter = 0; // To start kafkaRetryInterval process if any error occurs in later
                                                            clearInterval(kafkaRetryInterval); // Clearing the kafkaRetryInterval Process
                                                            kafkaRetryInterval = 0; // Clearing Retry Interval after connected with the Kafka Server
                                                        }
                                                    }
                                                });
                                            }
                                            kafka.Consumer = consumer; // for disconnect purpose
                                            return callback(consumer);
                                        } else {
                                            return callback(null);
                                        }
                                    });
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, 'New Kafka creation', objLogInfo);
                                    createInstancesOnRuntime(redisKey, isFromConsumerInstance, function (pResult) {
                                        try {
                                            if (pResult.status == 'SUCCESS') {
                                                kafka = mKafkaSessionValues[redisKey.toUpperCase()];
                                                CkeckKafkaIsRunning(kafka, async function (pRes) {
                                                    if (pRes == 'SUCCESS') {
                                                        var payloads = [{
                                                            topic: pTopic,
                                                            partition: kafkTopicPartition
                                                        }];
                                                        if (kafkaTopics && kafkaTopics.length) {
                                                            for (var u = 0; u < kafkaTopics.length; u++) {
                                                                const element = kafkaTopics[u];
                                                                var kafkaTopicObj = {};
                                                                kafkaTopicObj.topic = element;
                                                                if (totalTopicNames.indexOf(element) == -1) {
                                                                    totalTopicNames.push(element);
                                                                    var topicInfo = {};
                                                                    topicInfo.topicName = element;
                                                                    topicInfo.totalNoOfPartitions = kafkaTopicPartitionCount;
                                                                    totalTopicInfo.push(topicInfo);
                                                                }
                                                                kafkaTopicObj.partition = kafkTopicPartition;
                                                                payloads.push(kafkaTopicObj);
                                                            }
                                                        }
                                                        console.log(JSON.stringify(payloads, null, '\t'));
                                                        var jsonOptions = (mKafkaConfig['consumer_options']);
                                                        var maxPollInterval = jsonOptions.maxPollIntervalSec || 3600;//1 hr

                                                        var client = kafka.ConsumerClient;
                                                        var consumer;
                                                        var kafkaConfig;
                                                        if (isLatestPlatformVersion) {
                                                            var kafkaConfig = kafka.kafkaConfig;
                                                            // Creating AdminClient using RdKafka Npm   
                                                            consumer = kafka.kafka.consumer({ groupId: pGroupId });
                                                            // await consumer.connect();
                                                            kafka.maxKafkaMsgCount = maxKafkaMsgCount;
                                                            kafka.SERVICE_PARAMS = serviceParamRedisKeyValue;
                                                            kafka.OPTIONAL_PARAMS = pOptionalParam;
                                                            await consumer.subscribe({ topics: totalTopicNames });
                                                        } else {
                                                            var options = {
                                                                groupId: pGroupId,
                                                                autoCommit: jsonOptions['autoCommit'],
                                                                fetchMinBytes: jsonOptions['fetchMinBytes'],
                                                                fetchMaxBytes: jsonOptions['fetchMaxBytes'],
                                                                fromOffset: jsonOptions['fromOffset'],
                                                                fromBeginning: jsonOptions['fromBeginning']
                                                            };
                                                            Consumer = reqKafka.HighLevelConsumer;
                                                            consumer = new Consumer(client, payloads, options);
                                                        }
                                                        kafka.Consumer = consumer; // for disconnect purpose
                                                        return callback(consumer);
                                                    } else {
                                                        return callback(null);
                                                    }
                                                })
                                            } else {
                                                return callback(null);
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234010', 'Error in CkeckKafkaIsRunning function', error);
                                        }
                                    });
                                }
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'Accessing Default Kafka', objLogInfo);
                                var defaultRedisKey = (connString + '~' + defaultRoutingKey);
                                kafka = mKafkaSessionValues[defaultRedisKey.toUpperCase()];
                                if (kafka) {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Default Kafka Available', objLogInfo);
                                    prepareConsumer(kafka);
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Connecting default Kafka -1', objLogInfo);
                                    createInstancesOnRuntime(defaultRedisKey.toUpperCase(), isFromConsumerInstance, function (pResult) {
                                        try {
                                            if (pResult.status == 'SUCCESS') {
                                                kafka = mKafkaSessionValues[defaultRedisKey.toUpperCase()];
                                                prepareConsumer(kafka);
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234011', 'Error in CkeckKafkaIsRunning function', error);
                                        }
                                    });
                                }

                                function prepareConsumer(kafka) {
                                    CkeckKafkaIsRunning(kafka, async function (pRes) {
                                        if (pRes == 'SUCCESS') {
                                            var jsonOptions = mKafkaConfig['consumer_options'];
                                            var maxPollInterval = jsonOptions.maxPollIntervalSec || 3600;//1 hr
                                            var client = kafka.ConsumerClient;
                                            var consumer;
                                            var kafkaConfig;
                                            var payloads = [{
                                                topic: pTopic,
                                                partition: kafkTopicPartition
                                            }];
                                            if (kafkaTopics && kafkaTopics.length) {
                                                for (var u = 0; u < kafkaTopics.length; u++) {
                                                    const element = kafkaTopics[u];
                                                    var kafkaTopicObj = {};
                                                    kafkaTopicObj.topic = element;
                                                    if (totalTopicNames.indexOf(element) == -1) {
                                                        totalTopicNames.push(element);
                                                        var topicInfo = {};
                                                        topicInfo.topicName = element;
                                                        topicInfo.totalNoOfPartitions = kafkaTopicPartitionCount;
                                                        totalTopicInfo.push(topicInfo);
                                                    }
                                                    kafkaTopicObj.partition = kafkTopicPartition;
                                                    payloads.push(kafkaTopicObj);
                                                }
                                            }
                                            if (isLatestPlatformVersion) {
                                                var kafkaConfig = kafka.kafkaConfig;
                                                // Creating AdminClient   
                                                var serverInfo = kafkaConfig.SERVER + ':' + kafkaConfig.KAFKA_SERVER_PORT;
                                                const admin = kafka.kafka.admin()
                                                await admin.connect()
                                                kafka.AdminClient = admin;
                                                var rdKafkaConfig = {
                                                    'group.id': pGroupId,
                                                    'metadata.broker.list': serverInfo,
                                                    'enable.auto.commit': jsonOptions['autoCommit'],
                                                    'event_cb': true,
                                                    'max.poll.interval.ms': (maxPollInterval * 1000) // Converting Into MilliSeconds
                                                };
                                                kafka.maxKafkaMsgCount = maxKafkaMsgCount;
                                                kafka.SERVICE_PARAMS = serviceParamRedisKeyValue;
                                                kafka.OPTIONAL_PARAMS = pOptionalParam;
                                                consumer = kafka.kafka.consumer({ groupId: pGroupId });
                                                await consumer.subscribe({ topic: totalTopicNames[0] });
                                            } else {
                                                var options = {
                                                    groupId: pGroupId,
                                                    autoCommit: jsonOptions['autoCommit'],
                                                    fetchMinBytes: jsonOptions['fetchMinBytes'],
                                                    fetchMaxBytes: jsonOptions['fetchMaxBytes'],
                                                    fromOffset: jsonOptions['fromOffset'],
                                                    fromBeginning: jsonOptions['fromBeginning']
                                                    // ,'auto.offset.reset':'earliest'
                                                };
                                                Consumer = reqKafka.HighLevelConsumer;
                                                consumer = new Consumer(client, payloads, options);
                                            }
                                            console.log(JSON.stringify(payloads, null, '\t'));
                                            kafka.Consumer = consumer; // for disconnect purpose
                                            return callback(consumer);
                                        } else {
                                            return callback(null);
                                        }
                                    });
                                }
                            }
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234014', 'Error in CkeckKafkaIsRunning function', error);
                        }
                    });
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234015', 'Error in CkeckKafkaIsRunning function', error);
                }
            });
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234016', 'Error in CkeckKafkaIsRunning function', error);
    }
}

// get kafka instance by header routing key
function getKafkaInstance(pHeaders, callback) {
    try {
        var isFromConsumerInstance = false;
        var tmpKafkaObjLogInfo = (pHeaders && pHeaders.LOG_INFO) || null;
        reqInstanceHelper.PrintInfo(serviceName, 'GetKafkaInstance Begin', tmpKafkaObjLogInfo);
        var kafka = null;
        if (!pHeaders) {
            pHeaders = {};
        }
        reqInstanceHelper.PrintInfo(serviceName, 'routingkey ==== ' + pHeaders['routingkey'], tmpKafkaObjLogInfo);
        reqInstanceHelper.GetRedisKey(connString, pHeaders['routingkey'], function (redisKey) {
            try {
                reqInstanceHelper.PrintInfo(serviceName, 'Finding redisKey ==== ' + redisKey, tmpKafkaObjLogInfo);
                reqInstanceHelper.IsRedisKeyAvail(redisKey, function (result) {
                    try {
                        if (result) {
                            if (mKafkaSessionValues[redisKey]) {
                                reqInstanceHelper.PrintInfo(serviceName, 'Kafka key available', tmpKafkaObjLogInfo);
                                kafka = mKafkaSessionValues[redisKey.toUpperCase()];
                                return sendResult(kafka, true);
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'New Kafka creation', tmpKafkaObjLogInfo);
                                createInstancesOnRuntime(redisKey, isFromConsumerInstance, function (pResult) {
                                    try {
                                        if (pResult.status == 'SUCCESS') {
                                            kafka = mKafkaSessionValues[redisKey.toUpperCase()];
                                            return sendResult(kafka, false);
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.PrintError(serviceName, tmpKafkaObjLogInfo, 'ERR-KAF-234017', 'Error in getKafkaInstance function', error);
                                    }
                                });
                            }
                        } else {
                            reqInstanceHelper.PrintInfo(serviceName, 'Accessing Default Kafka', tmpKafkaObjLogInfo);
                            var defaultRedisKey = (connString + '~' + defaultRoutingKey).toUpperCase();
                            kafka = mKafkaSessionValues[defaultRedisKey.toUpperCase()];
                            if (kafka) {
                                reqInstanceHelper.PrintInfo(serviceName, 'Default Kafka Available', tmpKafkaObjLogInfo);
                                return sendResult(kafka, true);
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'Connecting default Kafka -2', tmpKafkaObjLogInfo);
                                createInstancesOnRuntime(defaultRedisKey, isFromConsumerInstance, function (pResult) {
                                    try {
                                        if (pResult.status == 'SUCCESS') {
                                            kafka = mKafkaSessionValues[defaultRedisKey.toUpperCase()];
                                            return sendResult(kafka, false);
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.PrintError(serviceName, tmpKafkaObjLogInfo, 'ERR-KAF-234018', 'Error in getKafkaInstance function', error);
                                    }
                                });
                            }
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, tmpKafkaObjLogInfo, 'ERR-KAF-234019', 'Error in getKafkaInstance function', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, tmpKafkaObjLogInfo, 'ERR-KAF-234020', 'Error in getKafkaInstance function', error);
            }
        });
        function sendResult(pkafka, NeedTopicCreation) {
            reqInstanceHelper.PrintInfo(serviceName, 'GetKafkaInstance End', tmpKafkaObjLogInfo);
            if (NeedTopicCreation) {
                CheckAndCreateDefaultKafkaTopics(pkafka, function () {
                    return callback(pkafka);
                })
            } else {
                return callback(pkafka);
            }
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, tmpKafkaObjLogInfo, 'ERR-KAF-234021', 'Error in getKafkaInstance function', error);
    }
}

// this will initiate to load connections for this service in runtime
function createInstancesOnRuntime(pRedisKey, isFromConsumerInstance, callback) {
    try {
        reqInstanceHelper.GetConfig(pRedisKey, function (pConf) {
            try {
                var objResult = JSON.parse(pConf);
                // objResult = kakfaDetails

                createKafkaInstance(pRedisKey, objResult, isFromConsumerInstance, function (pResult) {
                    try {
                        return callback(pResult);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234022', 'Error in createInstancesOnRuntime function', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234023', 'Error in createInstancesOnRuntime function', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234024', 'Error in createInstancesOnRuntime function', error);
    }
}

async function createTopic(KafkaIns, pArrTopicName, pCallback) {
    try {
        if (pArrTopicName.length) {
            if (KafkaIns.isLatestPlatformVersion) {
                var topicarr = [];
                for (var i = 0; i < pArrTopicName.length; i++) {
                    var topicobj = {
                        topic: pArrTopicName[i].topicName,
                        numPartitions: pArrTopicName[i].totalNoOfPartitions,
                        replicationFactor: pArrTopicName[i].totalNoOfReplicationFactors
                    };
                    topicarr.push(topicobj)
                }
                await KafkaIns.AdminClient.createTopics({
                    topics: topicarr
                })
                pCallback(null);
            } else {
                var topicNamesOnly = [];
                for (var c = 0; c < pArrTopicName.length; c++) {
                    topicNamesOnly.push(pArrTopicName[c].topicName);
                }
                KafkaIns.Producer.createTopics(topicNamesOnly, false, function (error, data) {
                    try {
                        if (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234025', 'Error in createTopic function', error);
                        } else {
                            reqInstanceHelper.PrintInfo(serviceName, 'Topic created - ' + pArrTopicName.toString() + '. Response : ' + data, null);
                        }
                        pCallback(error, data);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234026', 'Error in createTopic function', error);
                        pCallback(error, null);
                    }
                });
            }
        } else {
            pCallback(null, 'There is No Topic List for Creation..');
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234027', 'Error in createTopic function', error);
        pCallback(error, null);
    }
}

var arrDoConnect = [];
var arrRetryingKeys = [];

// initiate retry for failed instance creation
function doConnect(redisKey, isFromConsumerInstance, doConnectCB) {
    try {
        function callback(result) {
            try {
                if (result.status == 'SUCCESS') {
                    for (var i = 0; i < arrDoConnect.length; i++) {
                        var obj = arrDoConnect[i];
                        if (obj.redisKey == redisKey) {
                            clearInterval(obj.interval);
                            arrRetryingKeys.pop(redisKey);
                            arrDoConnect.pop(obj);
                            reqInstanceHelper.PrintInfo(serviceName, redisKey + ' Retry stoped.', null);
                            break;
                        }
                    }
                    retryKafka = false;
                    doConnectCB(result);
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234028', 'Error in doConnect function', error);
            }
        }
        // if (arrRetryingKeys.indexOf(redisKey, 0) > -1) {
        if (retryKafka || arrRetryingKeys.indexOf(redisKey, 0) > -1) {
            reqInstanceHelper.PrintInfo(serviceName, redisKey + ' Already Retrying.', null);
        } else {
            reqInstanceHelper.PrintInfo(serviceName, redisKey + ' Initiated Retrying.', null);
            var interval = setInterval(createInstancesOnRuntime, 15000, redisKey, isFromConsumerInstance, callback);
            var obj = {};
            obj.redisKey = redisKey;
            obj.interval = interval;
            arrRetryingKeys.push(redisKey);
            arrDoConnect.push(obj);
            retryKafka = true;
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234029', 'Error in doConnect function', error);
    }
}

// check all connected servers are in active state
function checkAllKafkaAvail(callback) {
    try {
        var i = 0;
        var returnStr = 'SUCCESS';
        //var result = 'SUCCESS';
        if (arrConnectedServers.length) {
            check(arrConnectedServers[i].keyName);

            function check(currentKey) {
                try {
                    i++;
                    var redisKey = currentKey;
                    var routingkey = redisKey.replace(connString + '~', '');
                    var headers = {
                        routingkey: routingkey
                    };
                    getKafkaInstance(headers, function (kafka) {
                        try {
                            CheckKafkaAvail(kafka, function (result) {
                                try {
                                    if (result == 'SUCCESS') {
                                        reqInstanceHelper.PrintInfo(serviceName, connString + ' in connected state', null);
                                    } else {
                                        reqInstanceHelper.PrintInfo(serviceName, connString + ' not connected', null);
                                        returnStr = result;
                                        //doConnect(redisKey);
                                    }
                                    if (i < arrConnectedServers.length) {
                                        check(arrConnectedServers[i].keyName);
                                    } else {
                                        if (arrRetryingKeys.length == 0) {
                                            return callback(returnStr);
                                        } else {
                                            return callback('FAILURE');
                                        }
                                    }
                                } catch (error) {
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234030', 'Error in checkAllKafkaAvail function', error);
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234031', 'Error in checkAllKafkaAvail function', error);
                        }
                    });
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234032', 'Error in checkAllKafkaAvail function', error);
                }
            }
        } else {
            if (arrRetryingKeys.length == 0) {
                return callback('SUCCESS');
            } else {
                return callback('FAILURE');
            }
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234033', 'Error in checkAllKafkaAvail function', error);
    }
}

// check is kafka producer available using ready event
function CheckKafkaInstanceAvail(kafka, callback) {
    try {
        var isLatestPlatformVersion = kafka.isLatestPlatformVersion || false;
        var isValueReturned = false;
        var producer = kafka.Producer;
        if (isLatestPlatformVersion) {
            producer.connect();
        }
        producer.on(producer.events.CONNECT, function (error) {
            if (!isValueReturned) {
                isValueReturned = true;
                CheckAndCreateDefaultKafkaTopics(kafka, function () {
                    return callback('SUCCESS');
                })
            } else {
                return callback('SUCCESS');
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234035', 'Error in CheckKafkaInstanceAvail function', error);
        return callback('FAILURE');
    }
}


// New Topic should be added in the Topic List [Replication Factor]
async function CheckAndCreateDefaultKafkaTopics(kafka, CheckAndCreateDefaultKafkaTopicsCB) {
    try {
        var kafkaConfig = kafka.kafkaConfig;
        var replicationFactor = (kafkaConfig.REPLICATION_FACTOR && Number(kafkaConfig.REPLICATION_FACTOR)) || 1;
        var partitions = (kafkaConfig.NUM_PARTITIONS && Number(kafkaConfig.NUM_PARTITIONS)) || 4;
        var isLatestPlatformVersion = kafka.isLatestPlatformVersion;
        // var defaultKafkaTopicList = []
        var defaultKafkaTopicList = [
            {
                topicName: 'DELETE_ORA_HST_TRAN_DATA',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'DELETE_PG_HST_TRAN_DATA',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'DELETE_PG_HST_FX_TABLE_DATA',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'DELETE_ORA_HST_FX_TABLE_DATA',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'DELETE_ORA_HST_PRC_TOKENS',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'DELETE_PG_HST_PRC_TOKENS',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'OTP',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'APCP_OTP',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'AUDIT_DATA',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'PRC_TOKENS',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'PRF.hst_prc_tokens',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'PRF.HST_PRC_TOKENS',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'CONTENT_DATA',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'PRF.hst_atmt_data',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'PRF.HST_ATMT_DATA',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'TRAN_DATA',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'TRACE_LOG',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'PRF.hst_trn_attachments',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'PRF.HST_TRN_ATTACHMENTS',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'PRF.hst_fx_table_data',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'PRF.HST_FX_TABLE_DATA',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'PRF.hst_tran_data',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'PRF.HST_TRAN_DATA',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'COMM_PROCESS_DATA',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'FX_COMM_PROCESS_MSG',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            },
            {
                topicName: 'FX_COMM_PROCESS_MSG_SUCCESS',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            }
            , {
                topicName: 'FX_COMM_PROCESS_MSG_FAILURE',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            }
            , {
                topicName: 'TRAN',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            }
            , {
                topicName: 'TRAN_VERSION',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            }
            , {
                topicName: 'TRAN_VERSION_DETAIL',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            }
            , {
                topicName: 'FX_TRAN',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            }
            , {
                topicName: 'TRAN_JOURNEY_DETAIL',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            }
            , {
                topicName: 'TRAN_JOURNEY_TO_SOLR',
                totalNoOfReplicationFactors: replicationFactor,
                totalNoOfPartitions: partitions
            }
        ];
        if (isLatestPlatformVersion) {
            const admin = kafka.kafka.admin()
            await admin.connect()
            var existingTopics = await admin.listTopics() || []
            var notExistingTopics = [];
            for (var r = 0; r < defaultKafkaTopicList.length; r++) {
                var topicInfo = defaultKafkaTopicList[r];
                var topicNameIndex = existingTopics.findIndex(obj => obj == topicInfo.topicName);
                if (topicNameIndex == -1) {
                    notExistingTopics.push(topicInfo);
                }
            }
            reqInstanceHelper.PrintInfo(serviceName, 'Existing Kafka Topic Count - ' + existingTopics.length, null);
            reqInstanceHelper.PrintInfo(serviceName, 'Default Kafka Topic Count - ' + defaultKafkaTopicList.length, null);
            reqInstanceHelper.PrintInfo(serviceName, 'Not Existing Kafka Topic Count - ' + notExistingTopics.length, null);
            kafka.AdminClient = admin;
            createTopic(kafka, notExistingTopics, CheckAndCreateDefaultKafkaTopicsCB);
        } else {
            CheckAndCreateDefaultKafkaTopicsCB();
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234043', 'Catch Error CheckAndCreateDefaultKafkaTopics()...', error);
        CheckAndCreateDefaultKafkaTopicsCB();
    }

}


// check kafka available using create test topic
function CheckKafkaAvail(kafka, callback) {
    try {
        var producer = kafka.Producer;
        producer.createTopics(['test'], false, function (error, data) {
            if (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234036', 'Error in CheckKafkaAvail function', error);
                return callback('FAILURE');
            } else {
                return callback('SUCCESS');
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KAF-234037', 'Error in CheckKafkaAvail function', error);
    }
}

// disconnect all connected servers properly
function Disconnect(callback) {
    try {
        var i = 0;
        if (arrConnectedServers.length) {
            doDisconnect(arrConnectedServers[i].keyName);
        } else {
            mKafkaSessionValues = {};
            arrConnectedServers = [];
            return callback();
        }

        function doDisconnect(currentKey) {
            try {
                i++;
                var kafka = mKafkaSessionValues[currentKey];
                if (kafka.isLatestPlatformVersion) {
                    if (kafka.Producer) {
                        kafka.Producer.disconnect();
                    }
                    if (kafka.Consumer) {
                        kafka.Consumer.disconnect();
                    }
                    if (kafka.AdminClient) {
                        kafka.AdminClient.disconnect();
                    }
                } else {
                    kafka.Producer.close();
                    kafka.Producer.client.close();
                    if (kafka.Consumer) {
                        kafka.Consumer.close();
                    }
                    kafka.ConsumerClient.close();
                }
                reqInstanceHelper.PrintInfo(serviceName, currentKey + '.....Disconnected.', null);
                if (i < arrConnectedServers.length) {
                    doDisconnect(arrConnectedServers[i].keyName);
                } else {
                    mKafkaSessionValues = {};
                    arrConnectedServers = [];
                    return callback();
                }
            } catch (error) {
                return callback(error);
            }
        }
    } catch (error) {
        return callback(error);
    }
}

// Committing Offsets
function DoCommit(params, DoCommitCB) {
    try {
        var consumer = params.Consumer;
        if (params.isLatestPlatformVersion) {
            consumer.commit(); // For RDKafka NPM latest
            DoCommitCB();
        } else { // For kafka-node NPM old
            consumer.commit(function () {
                DoCommitCB();
            });
        }
    } catch (error) {
        DoCommitCB();
    }
}

function creteExternalKafkaConnectionRuntime(objLogInfo, pcltConn, pRoutingKey, psetup, pcallback) {
    try {
        var pcond = {
            category: psetup
        }
        reqDBInstance.GetTableFromFXDB(pcltConn, 'TENANT_SETUP', [], pcond, objLogInfo, async function (pErr, pResult) {
            try {
                if (pErr) {
                    reqInstanceHelper.PrintInfo(serviceName, 'Error occured while query tenant setup.', objLogInfo);
                    var res = {
                        status: "FAILURE",
                        data: "Error occured while query tenant setup " + pErr
                    }
                    return pcallback(pErr)
                } else {
                    if (pResult.rows.length) {
                        reqInstanceHelper.PrintInfo(serviceName, 'Got the setup value.', objLogInfo);
                        var setupJson = JSON.parse(pResult.rows[0].setup_json).KAFKA;

                        var kafkaConfig = {
                            clientId: 'EXT_KAFKA'
                        }
                        if (setupJson.SERVER.indexOf(",") > -1 || setupJson.SERVER.indexOf(":") > -1) {
                            kafkaConfig.brokers = setupJson.SERVER.split(",")
                        } else {
                            kafkaConfig.brokers = [`${setupJson.SERVER}:${setupJson.PORTNO}`]
                        }
                        var kafkaSSL = {};
                        if (setupJson.NEED_REJECT_UNAUTH == "Y") {
                            kafkaSSL['rejectUnauthorized'] = setupJson.REJECT_UNAUTH
                        }
                        if (setupJson.NEED_CA == "Y" && setupJson.CA_PATH) {
                            kafkaSSL['ca'] = [fs.readFileSync(`${setupJson.CA_PATH}`, 'utf-8')]
                        }
                        if (setupJson.NEED_KEY == "Y" && setupJson.KEY_PATH) {
                            kafkaSSL['key'] = fs.readFileSync(`${setupJson.KEY_PATH}`, 'utf-8')
                        }
                        if (setupJson.NEED_CERT == "Y" && setupJson.CERT_PATH) {
                            kafkaSSL['cert'] = fs.readFileSync(`${setupJson.CERT_PATH}`, 'utf-8')
                        }
                        if (Object.keys(kafkaSSL).length > 0) {
                            kafkaConfig.ssl = kafkaSSL
                        }
                        console.log('kafkaConfig | ' + JSON.stringify(kafkaConfig));
                        const extKafka = new Kafka(kafkaConfig)
                        var Extproducer = extKafka.producer();
                        await Extproducer.connect();
                        mKafkaSessionValues['EXT_KAFKA_' + pRoutingKey + "_" + psetup] = Extproducer;
                        var res = {};
                        res.status = "SUCCESS";
                        res.kafkaIns = Extproducer;
                        res.topicName = setupJson.DEFAULT_TOPIC;
                        pcallback(res)
                    } else {
                        var res = {
                            status: "FAILURE",
                            data: "Tenant Setup not found"

                        }
                        pcallback(res)
                    }
                }
            } catch (error) {
                reqInstanceHelper.PrintInfo(serviceName, 'Exception occured while getting tenant setup value.' + error, objLogInfo);
                var res = {
                    status: "FAILURE",
                    data: "Exception occured while getting external kafka connection " + error.stack
                }
                pcallback(res)
            }
        })
    } catch (error) {

    }
}

function GetExtkafkaConn(objLogInfo, pcltConn, pRoutingKey, psetup, pcallback) {
    try {
        if (mKafkaSessionValues['EXT_KAFKA_' + pRoutingKey + "_" + psetup]) {
            var res = {};
            res.status = "SUCCESS";
            res.kafkaIns = mKafkaSessionValues['EXT_KAFKA_' + pRoutingKey + "_" + psetup]
            pcallback(res)
        } else {
            creteExternalKafkaConnectionRuntime(objLogInfo, pcltConn, pRoutingKey, psetup, function (response) {
                pcallback(response)
            })
        }
    } catch (error) {

    }
}


module.exports = {
    CreateKafkaInstance: createKafkaInstance,
    GetKafkaInstance: getKafkaInstance,
    GetConsumer: getConsumer,
    CreateTopic: createTopic,
    CheckAllKafkaAvail: checkAllKafkaAvail,
    Disconnect: Disconnect,
    DoCommit: DoCommit,
    GetExtkafkaConn: GetExtkafkaConn
};