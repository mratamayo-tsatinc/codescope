/*
@codescope
@title Integer and If Else with nested if Else
@seed age min=17 max=21
@seed score min=80 max=84
@seed points min=3 max=7
*/
#include <stdio.h>

int main(void)
{
    int age = 19;
    int score = 82;
    int points = 5;
    int status = 0;

    if (age >= 18) {
        points = points + 5;

        if (score >= 80) {
            points = points + 10;
            status = 1;
        } else {
            points = points + 2;
            status = 2;
        }
    } else {
        points = points - 1;
        status = 3;
    }

    printf("age = %d\n", age);
    printf("score = %d\n", score);
    printf("points = %d\n", points);
    printf("status = %d\n", status);

    return 0;
}
