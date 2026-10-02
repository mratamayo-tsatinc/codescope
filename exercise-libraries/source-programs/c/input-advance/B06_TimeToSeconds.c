/*
@codescope
@title Hours, Minutes, Seconds to Total Seconds
@result totalSeconds
@input target=hours value=1 min=0 max=23
@input target=minutes value=25 min=0 max=59
@input target=seconds value=30 min=0 max=59
*/
#include <stdio.h>

int main() {
    int hours;
    int minutes;
    int seconds;
    int totalSeconds;

    printf("Enter hours minutes seconds: ");
    scanf("%d %d %d", &hours, &minutes, &seconds);
    totalSeconds = hours * 3600 + minutes * 60 + seconds;
    printf("Total seconds: %d\n", totalSeconds);
    return 0;
}
