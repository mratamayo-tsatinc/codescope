/*
@codescope
@title Independent if statement
@seed score min=65 max=100
@seed absences min=0 max=8
*/
public class IfStatement {
    public static void main(String[] args) {
        int score = 82;
        int absences = 2;

        if (score >= 75 && absences < 5) {
            System.out.println("Requirements met.");
        }
        System.out.println("Evaluation complete.");
    }
}
