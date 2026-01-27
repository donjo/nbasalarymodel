# nbasalarymodel
This is a salary model that I built for NBA players that projects current year salary + salary five years into the future. Here is a methodology of how it works. 

The main basis for how to build this model came from Chapter 7 of Seth Partnow's excellent book, The Midrange Theory. Seth outlines the process whereby you pick your favorite adjusted plus-minus metric, multiply by possessions and cost of average win, and come out with a contract valuation. 

In the simplest terms, salary = impact * playing time. In the more nitty-gritty, salary = total minutes / 1475 * (DARKO + 3) * 4.32, where 4.32 is the average cost of a win in 2025-26 dollars). There are a few other adjustments made to that calculation, which I detail below. 

What this model does better than other ones is solve for the biggest problem of any win projection model or salary model: Inaccurate minutes projections. Being off on minutes projections can make a model look terrible. Most people use Kevin Pelton's projections, which are pretty good and generously made availably by him upon request. A better minutes projection comes from crowd-sourcing them from diehard fans, who have a better pulse on rotations than anyone. 

This model allows each user to come up with their own minutes projection. If it's wrong, it's on you. If you think the DARKO value is off, it also allows you to adjust to what you deem the "correct" value. 

I used Kostya Medvedovsky's DARKO as the APM metric for the basis of this model for a few different reasons. 1) It was ranked as the best in a survey of NBA personnel and stats folks a few years back and 2) Its goal is to be predictive, looking forward, rather than looking back like some other APM metrics. 

This model makes improvements on an older one I built in a couple of different ways. First, there is an aging curve built in, along with inflation baked in for future years from salary cap increases (estimates taken from RealGM). 

This model also tries to sovle for the problem that Parntnow writes about, that "valuing wins can be tricky, as not all wins are created equal." 

Getting from 60 to 65 wins is a lot more valuable than going from 20 to 25. MVP caliber players take you to that level, which is why they are still generally underpaid even on maximum salaries relative to their impact. I improvised a way to tackle that problem, using another curve that tops out at a 10 percent bonus for MVP-caliber players and deducts 10 percent for replacement-level players. 

There are a few improvements which I hope to make to this model down the line, the primary one being a positional adjustment that penalizes small guards/centers and rewards wings. 
