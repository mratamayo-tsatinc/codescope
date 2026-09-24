/*
@codescope
@title Else if chain
@seed grade min=70 max=100
*/
public class ElseIfChain {
    public static void main(String[] args) {
        int grade = 86;

        if (grade >= 90) {
            System.out.println("Excellent.");
        }
        else if (grade >= 80) {
            System.out.println("Very good.");
        }
        else {
            System.out.println("Keep practicing.");
        }
    }
}
