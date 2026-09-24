/*
@codescope
@title Else if chain
@seed grade min=70 max=100
*/
#include <stdio.h>

int main() {
    int grade = 86;

    if (grade >= 90) {
        printf("Excellent.\n");
    }
    else if (grade >= 80) {
        printf("Very good.\n");
    }
    else if (grade >=75) {
        printf("Good.\n");
    }
    else {
        printf("Keep practicing.\n");
    }

    printf("******************\n");
    printf("   Thank you!\n");
    printf("******************\n");

    return 0;
}
