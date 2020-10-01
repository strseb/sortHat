const Discord = require('discord.js');
const discordClient = new Discord.Client();

const log = (s) => {
    let t = new Date();
    console.log(`${t.getHours()}:${t.getMinutes()}:${t.getSeconds()} - \t ${s}`);
}


/*
    Gets a Guild, scanns all members and the auditlog 
    trys to find the closest invitation and sets the
    invitee

    returns [
        ...,
        {
            when: int<Timestamp>
            who : int<memberID> // might be 0 if unknown
            invitedBy: int<memberID>
        },
        ...
    ]
*/
async function invitationParents(guild) {
    const auditLog = await guild.fetchAuditLogs();
    const invites = auditLog.entries.filter(l => l.action === "INVITE_CREATE").map(l => {
        return {
            when: l.createdAt,
            who: l.executor.id
        }
    })
    let member = await guild.members.fetch();
    
    const joinLog = member.map(user => {
        return { when: user.joinedAt, id: user.id }
    })



    let causeMap = joinLog.map(joinedUser => {
        let causingInvite = { when: 0, who: 0 };
        invites.reverse().forEach(invite => {
            if (invite.when < joinedUser.when && invite.when > causingInvite.when) {
                causingInvite = invite;
            }
        })

        return { invitedBy: causingInvite.who, ...joinedUser }
    });

    return causeMap;
};

// ID's of roles that will be inherited on invite
const INHERITABLE = ["Ravenclaw","Hufflepuff","Gryffindor","Slytherin"];

(async () => {
    const promise_loggedin = new Promise(r => discordClient.on('ready', r));
    discordClient.login(process.env.DISCORD);
    await promise_loggedin;

    let guildsDone = discordClient.guilds.cache.map(async guild => {
        let invitatorMap = await invitationParents(guild);

        let done = invitatorMap.map(async entry => {
            let who = await guild.members.fetch(entry.id);
            if(entry.invitedBy == 0){
                return;
            }
            let by = await guild.members.fetch(entry.invitedBy);
            let roleCheck = by.roles.cache.map(async rl =>{
                if(!INHERITABLE.includes(rl.name)){
                    return;
                }
                if(who.roles.cache.some(i => i.name === rl.name)){
                    return;
                }
                try {
                    log(`Adding ${who.displayName} to ${rl.name}`);
                    await who.roles.add(rl);
                } catch (error) {
                    console.log(error);
                }
            });
            await Promise.all(roleCheck);
        });
        await Promise.all(done);  
    });
    await Promise.all(guildsDone)
    console.log("done");
    await discordClient.destroy();
})();



