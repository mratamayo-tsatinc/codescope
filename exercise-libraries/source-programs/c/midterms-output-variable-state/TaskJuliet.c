/*
@codescope
@title Values of different types
@seed age min=18 max=35
@seed height min=150.0 max=190.0 decimals=1
@seed grade values='A'|'B'|'C'
@seed name values="Maria"|"Diego"|"Amina"
*/
#include <stdio.h>

int main() {
    int age = 20;
    float height = 165.5;
    char grade = 'A';
    char name[] = "Maria";

    printf("Name: %s\n", name);
    printf("Age: %d\n", age);
    printf("Height: %.1f cm\n", height);
    printf("Grade: %c\n", grade);
    printf("Pi (2 decimals): %.2f\n", 3.14159);
    printf("Pi (4 decimals): %0.4f\n", 3.14159);
    return 0;
}
