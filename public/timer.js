class timer {
    constructor() {
        this.defendedTime = 0;
        this.defendingTime = 0;
        this.thinkingTime = 0;
        this.ballTime = 0;
        this.panelTime = 0;

        this.lastTime = 0;

        this.intermissionTimeStart = 0;
        this.totalIntermission = 0;
    }

    updateCycle(state) {
        let timeChange = (Date.now() / 1000) - this.lastTime;

        // if (state == "defended") {
        //     this.defendedTime += timeChange;
        // } else if (state == "defending"){
        //     this.defending += timeChange;
        // } else if (state == "thinking") {
        //     this.thinkingTime += timeChange;
        // } else 
        
        if (state == "ball") {
            this.ballTime += timeChange - this.totalIntermission;
            console.log("ball time: " + this.ballTime);
        } else if (state == "panel") {
            this.panelTime += timeChange - this.totalIntermission;
        }

        this.totalIntermission = 0;
        this.lastTime = Date.now() / 1000;
    }

    start() {
        this.lastTime = Date.now() / 1000;
    }

    addIntermissionTimes(start, type) {
        if (start == 1) {
            this.intermissionTimeStart = Date.now() / 1000;
        } else {
            let timeChange = (Date.now() / 1000) - this.intermissionTimeStart
            if (type == "idle"){
                this.thinkingTime += timeChange;
            } else if (type == "defending") {
                this.defendingTime += timeChange;
            } else if (type == "defended") {
                this.defendedTime += timeChange;
            }
            this.totalIntermission += timeChange;
            this.intermissionTimeStart = 0;
            console.log(this.totalIntermission)
        }
    }

    getTimes() {
        // Math.round((autoDataArray[0].length/4) * 10)/10
        return {defended: Math.round(this.defendedTime * 10)/10, 
                defending: Math.round(this.defendingTime * 10)/10,
                idle: Math.round(this.thinkingTime * 10)/10, 
                ball: Math.round(this.ballTime * 10)/10, 
                panel: Math.round(this.panelTime * 10)/10};
    }
}