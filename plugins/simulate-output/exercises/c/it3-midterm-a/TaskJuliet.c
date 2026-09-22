/*
@output
Name: Maria
Age: 20
Height: 165.5 cm
Grade: A
Pi (2 decimals): 3.14
Pi (4 decimals): 3.1416

@variables
age = 20
height = 165.5
grade = A
name = Maria
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