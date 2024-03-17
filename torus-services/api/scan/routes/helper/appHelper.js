var reqRedis = require('redis');
//var reqGssInit = require('gss_init');

var config = require('../../../../config/config.json'); //reqGssInit.getConf;
var strRedisServerPort = config.RedisServer.Port;
var strRedisServer = config.RedisServer.Server;
var clientRedis = reqRedis.createClient(strRedisServerPort, strRedisServer);

var cassandraInstance = require('../../../../references/helper/CassandraInstance'); //reqGssInit.getCassandraInstance;
var tranDBInstance = require('../../../../references/helper/TranDBInstance'); //reqGssInit.getTranDBInstance;
var kafkaInstance = require('../../../../references/helper/KafkaInstance'); //reqGssInit.getKafkaInstance;
var solrInstance = require('../../../../references/helper/SolrInstance'); //reqGssInit.getSolrInstance;

var cassandraLoaded = false;
var tranDBLoaded = false;
var kafkaLoaded = false;
var solrSearchLoaded = false;
var solrLogLoaded = false;

function successCall(callback) {
    if (cassandraLoaded && tranDBLoaded && kafkaLoaded && solrSearchLoaded && solrLogLoaded) {
        return callback('SUCCESS');
    }
}

function getAllRedisKeys(callback) {
    clientRedis.keys('*', function(err, keys) {
        if (err) {
            return console.log(err);
        } else {
            return callback(keys);
        }
    });
}

// get detail from redis server
function getAllConfig(pKey, pCallback) {
    clientRedis.exists(pKey, function(err, reply) {
        if (reply === 1) {
            clientRedis.get(pKey, function(err, reply) {
                pCallback(reply.toString(), err)
            });
        } else {
            console.log('Does not exists the ' + pKey + ' on Redis server')
            console.log('Error : ' + err)
        }
    });
}

var arrRedisKeys = [];
var i = 0;
var configKeyCount = 0;

function doNextCall(callback) {
    if (i < arrRedisKeys.length) {
        createInstance(arrRedisKeys[i], callback);
    }
}

var isCassandraCurrentKey = false;
var isTranCurrentKey = false;
var isKafkaCurrentKey = false;
var isSolrSearchCurrentKey = false;
var isSolrLogCurrentKey = false;

function createInstance(currentKey, callback) {
    i++;
    getAllConfig(currentKey, function(pResult) {
        isCassandraCurrentKey = false;
        isTranCurrentKey = false;
        isKafkaCurrentKey = false;
        isSolrSearchCurrentKey = false;
        isSolrLogCurrentKey = false;
        var objResult = JSON.parse(pResult);
        if (objResult.CASSANDRA) {
            cassandraInstance.CreateCassandraInstance(currentKey, objResult.CASSANDRA, function(pResult) {
                if (pResult.status == 'SUCCESS') {
                    isCassandraCurrentKey = true;
                    currentKeyLoaded(callback);
                    if (pResult.sessionCount == arrRedisKeys.length) {
                        cassandraLoaded = true;
                        successCall(callback);
                    }
                }
            });
        }
        if (objResult.TRANDB) {
            tranDBInstance.CreateTranDBInstance('pg', 'knex', currentKey, objResult.TRANDB, function(pResult) {
                if (pResult.status == 'SUCCESS') {
                    isTranCurrentKey = true;
                    currentKeyLoaded(callback);
                    if (pResult.sessionCount == arrRedisKeys.length) {
                        tranDBLoaded = true;
                        successCall(callback);
                    }
                }
            });
        }
        if (objResult.KAFKA) {
            kafkaInstance.CreateKafkaInstance(currentKey, objResult.KAFKA, function(pResult) {
                if (pResult.status == 'SUCCESS') {
                    isKafkaCurrentKey = true;
                    currentKeyLoaded(callback);
                    if (pResult.sessionCount == arrRedisKeys.length) {
                        kafkaLoaded = true;
                        successCall(callback);
                    }
                }
            });
        }
        if (objResult.SOLR_SEARCH) {
            solrInstance.CreateSolrInstance(currentKey, objResult.SOLR_SEARCH, function(pResult) {
                if (pResult.status == 'SUCCESS') {
                    isSolrSearchCurrentKey = true;
                    currentKeyLoaded(callback);
                    if (pResult.sessionCount == arrRedisKeys.length) {
                        solrSearchLoaded = true;
                        successCall(callback);
                    }
                }
            });
        }
        if (objResult.SOLR_LOG) {
            solrInstance.CreateSolrInstance(currentKey, objResult.SOLR_LOG, function(pResult) {
                if (pResult.status == 'SUCCESS') {
                    isSolrLogCurrentKey = true;
                    currentKeyLoaded(callback);
                    if (pResult.sessionCount == arrRedisKeys.length) {
                        solrLogLoaded = true;
                        successCall(callback);
                    }
                }
            });
        }
    });
}

function currentKeyLoaded(callback) {
    if (isCassandraCurrentKey && isTranCurrentKey && isKafkaCurrentKey && isSolrSearchCurrentKey && isSolrLogCurrentKey) {
        doNextCall(callback);
    }
}

exports.LoadAllInstanses = function(callback) {
    console.log('Instances loading...');
    getAllRedisKeys(function(keys) {
        arrRedisKeys = keys;
        var configArr = [];
        for (var j = 0; j < arrRedisKeys.length; j++) {
            if (arrRedisKeys[j].indexOf('CONFIG_') != -1) {
                configArr.push(arrRedisKeys[j].toUpperCase());
            }
        }
        arrRedisKeys = configArr;
        createInstance(arrRedisKeys[i], callback);
    });
}