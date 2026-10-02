/*
@codescope
@title Exam Average with Section Code
@result average
@input target=prelim value=82 min=0 max=100
@input target=midterm value=90 min=0 max=100
@input target=final value=88 min=0 max=100
*/
#include <stdio.h>

int main() {
    int prelim;
    int midterm;
    int final;
    float average;

    printf("Enter prelim, midterm and final scores: ");
    scanf("%d %d %d", &prelim, &midterm, &final);
    average = (prelim + midterm + final) / 3;
    printf("Average: %.2f\n", average);
    return 0;
}
