export default function stoi(val: any) {
    if (typeof val === "string") {
        return parseInt(val); 
    }
    else {
        return val;  
    } 
}