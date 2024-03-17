// const { Kafka } = require('kafkajs');

// // Create Kafka client
// const kafka = new Kafka({
//     clientId: 'my-kafka-app',
//     brokers: ['192.168.2.233:32374'], // Specify your Kafka brokers here
// });

// // Create Kafka consumer
// const consumer = kafka.consumer({ groupId: 'COMM_PROCESS_DATA_GRP_TEST' });

// // Topic and partition to consume from
// const topic = 'COMM_PROCESS_DATA';
// // const partition = 0;

// // Function to handle message processing
// const processMessage = async (topic, partition, message) => {
//     try {
//         console.log(`Received message: ${'partition ' + partition + ' offset ' + message.offset}`);
//         // Perform your message processing logic here

//         // Manually commit the offset
//         // await consumer.commitOffsets([{ topic, partition, offset: message.offset }]);

//         await consumer.commitOffsets([{ topic: topic, partition: partition, offset: message.offset }]);
//         // await consumer.commitOffsets([{ topic, partition, offset: message.offset }]);

//     } catch (error) {
//         console.log(error)
//     }


// };

// // Start the consumer
// const runConsumer = async () => {
//     try {
//         await consumer.connect();
//         await consumer.subscribe({ topic, fromBeginning: true });

//         await consumer.run({
//             autoCommit: false,
//             eachMessage: async ({ topic, partition, message }) => {
//                 await processMessage(topic, partition, message);
//             },
//         });
//     } catch (error) {
//         console.log(error)
//     }

// };

// // Run the consumer
// runConsumer().catch((error) => {
//     console.error(`Error in consumer: ${error}`);
//     process.exit(1);
// });





const { Kafka } = require('kafkajs')

const kafka = new Kafka({
    clientId: 'my-app',
    brokers: ['192.168.2.233:32374'], // Specify your Kafka brokers here
})

const consumer = kafka.consumer({ groupId: 'COMM_PROCESS_DATA_GRP_TEST6' })

const run = async () => {

    // Consuming
    await consumer.connect()
    await consumer.subscribe({ topic: 'COMM_PROCESS_DATA', fromBeginning: true })
    var uid = 0
    await consumer.run({

        autoCommit: false,
        eachMessage: async ({ topic, partition, message }) => {
            uid = uid + 1
            if (uid >= 5) {
                if (message.offset - 1 >= '0') {
                    await commitkafkaofset(topic, partition, message.offset - 1);
                    uid = uid - 1
                }

            } else {
                console.log({
                    partition,
                    offset: message.offset,
                    value: message.value.toString(),
                })

                await commitkafkaofset(topic, partition, (Number(message.offset) + 1).toString())
            }

        },
    })
    async function commitkafkaofset(pTopic, pPartition, pOffset) {
        try {
            await consumer.commitOffsets([{ topic: pTopic, partition: pPartition, offset: pOffset }])
        } catch (error) {
            console.log(error)
        }

    }
}

run().catch(console.error)