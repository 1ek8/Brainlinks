export function hashgen(len: number){
    const hashPool = "qwertyuiopasdfghjklzxcvbnm1234567890";
    
    let ans = "";
    const poolLength = hashPool.length;

    for(let i = 0; i< len; i++){
        // ans += hashPool[Math.floor(Math.random() * hashPool.length())]
        ans += hashPool[Math.floor(Math.random() * poolLength)]
    }

    return ans;
}